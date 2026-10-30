import * as path from 'node:path';

import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, TimeZone, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

// appUrl is the CloudFront URL, known after the first deploy.
type Props = StackProps & {
  senderEmail: string;
  githubSubject: string;
  appUrl?: string;
  webAclArn: string;
};

const API_PORT = 8000;
// The cheapest model this account can use that passes the evals (api/evals).
// Sonnet costs 3x as much and isn't needed for these short, record-bound answers.
const MODEL = 'anthropic.claude-haiku-4-5-20251001-v1:0';

export class EduLiftStack extends Stack {
  // Fixed so synth needs no AWS lookup.
  override get availabilityZones(): string[] {
    return ['af-south-1a', 'af-south-1b'];
  }

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // No NAT gateway: tasks use public IPs but only accept VPC traffic.
    const vpc = new ec2.Vpc(this, 'Network', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    const apiTasks = new ec2.SecurityGroup(this, 'ApiTasks', {
      vpc,
      description: 'EduLift API tasks',
    });
    apiTasks.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(API_PORT), 'load balancer');

    // Private, encrypted, TLS only.
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('edulift'),
      databaseName: 'edulift',
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageEncrypted: true,
      // Free plan max. Raise to 7 after upgrading.
      backupRetention: Duration.days(1),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      parameters: { 'rds.force_ssl': '1' },
    });
    database.connections.allowDefaultPortFrom(apiTasks);
    const dbSecret = database.secret!;

    // Email codes only. The API creates users after rate limiting.
    const users = new cognito.UserPool(this, 'Users', {
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      signInAliases: { email: true },
      selfSignUpEnabled: false,
      signInPolicy: { allowedFirstAuthFactors: { password: true, emailOtp: true } },
      passwordPolicy: { minLength: 16 },
      accountRecovery: cognito.AccountRecovery.NONE,
      email: cognito.UserPoolEmail.withSES({
        fromEmail: props.senderEmail,
        fromName: 'EduLift',
        sesRegion: this.region,
      }),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const appClient = users.addClient('App', {
      authFlows: { user: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.hours(8),
      refreshTokenRotationGracePeriod: Duration.seconds(10),
    });

    // The API refuses requests without this CloudFront header.
    const originSecret = new secrets.Secret(this, 'OriginSecret', {
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });

    const image = new DockerImageAsset(this, 'ApiImage', {
      directory: path.join(__dirname, '..', '..'),
      file: 'api/Dockerfile',
      platform: Platform.LINUX_AMD64,
    });
    const executionRole = new iam.Role(this, 'ApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    dbSecret.grantRead(executionRole);
    originSecret.grantRead(executionRole);

    // Signs the shared demo sign-in. Generated here, never typed or written to a file.
    const demoSecret = new secrets.Secret(this, 'DemoSecret', {
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    demoSecret.grantRead(executionRole);
    image.repository.grantPull(executionRole);

    const taskRole = new iam.Role(this, 'ApiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    users.grant(
      taskRole,
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminDeleteUser',
    );
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/${props.senderEmail}`],
      }),
    );

    const profile = `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/global.${MODEL}`;
    taskRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: [profile] }),
    );
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/${MODEL}`,
          `arn:aws:bedrock:::foundation-model/${MODEL}`,
        ],
        conditions: { StringEquals: { 'bedrock:InferenceProfileArn': profile } },
      }),
    );

    const infrastructureRole = new iam.Role(this, 'ApiInfrastructureRole', {
      assumedBy: new iam.ServicePrincipal('ecs.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSInfrastructureRoleforExpressGatewayServices',
        ),
      ],
    });
    const apiLogs = new logs.LogGroup(this, 'ApiLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const settings: Record<string, string> = {
      EDULIFT_ENV: 'demo',
      IDENTITY_PROVIDER: 'cognito',
      AWS_REGION: this.region,
      COGNITO_USER_POOL_ID: users.userPoolId,
      COGNITO_APP_CLIENT_ID: appClient.userPoolClientId,
      DB_HOST: database.dbInstanceEndpointAddress,
      DB_PORT: database.dbInstanceEndpointPort,
      DB_NAME: 'edulift',
      TRUSTED_PROXY_HOPS: '2',
      SENDER_EMAIL: props.senderEmail,
      APP_URL: props.appUrl ?? '',
      AI_ENABLED: 'true',
      BEDROCK_MODEL_ID: `global.${MODEL}`,
    };
    const secretRefs: [string, secrets.ISecret, string?][] = [
      ['DB_USER', dbSecret, 'username'],
      ['DB_PASSWORD', dbSecret, 'password'],
      ['ORIGIN_SECRET', originSecret],
      ['DEMO_SECRET', demoSecret],
    ];

    const api = new ecs.CfnExpressGatewayService(this, 'Api', {
      serviceName: 'edulift',
      executionRoleArn: executionRole.roleArn,
      infrastructureRoleArn: infrastructureRole.roleArn,
      taskRoleArn: taskRole.roleArn,
      cpu: '256',
      memory: '512',
      healthCheckPath: '/v1/health',
      networkConfiguration: {
        subnets: vpc.publicSubnets.map((s) => s.subnetId),
        securityGroups: [apiTasks.securityGroupId],
      },
      scalingTarget: { minTaskCount: 1, maxTaskCount: 2 },
      primaryContainer: {
        image: image.imageUri,
        containerPort: API_PORT,
        awsLogsConfiguration: { logGroup: apiLogs.logGroupName, logStreamPrefix: 'api' },
        environment: Object.entries(settings).map(([name, value]) => ({ name, value })),
        secrets: secretRefs.map(([name, secret, key]) => ({
          name,
          valueFrom: key ? `${secret.secretArn}:${key}::` : secret.secretArn,
        })),
      },
    });
    api.node.addDependency(executionRole, taskRole, infrastructureRole, database);

    const jobs = new ecs.FargateTaskDefinition(this, 'Jobs', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole,
      taskRole,
    });
    jobs.addContainer('job', {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      environment: settings,
      secrets: Object.fromEntries(
        secretRefs.map(([name, secret, key]) => [name, ecs.Secret.fromSecretsManager(secret, key)]),
      ),
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLogs, streamPrefix: 'job' }),
    });
    // Express Mode runs in the account's default cluster.
    const cluster = ecs.Cluster.fromClusterAttributes(this, 'Default', { clusterName: 'default', vpc });
    const daily = (id: string, module: string, hour: number) =>
      new scheduler.Schedule(this, id, {
        schedule: scheduler.ScheduleExpression.cron({ hour: String(hour), minute: '0', timeZone: TimeZone.AFRICA_JOHANNESBURG }),
        target: new targets.EcsRunFargateTask(cluster, {
          taskDefinition: jobs,
          assignPublicIp: true,
          vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
          securityGroups: [apiTasks],
          input: scheduler.ScheduleTargetInput.fromObject({
            containerOverrides: [{ name: 'job', command: ['python', '-m', module] }],
          }),
        }),
      });
    daily('Reminders', 'app.jobs.reminders', 7);
    daily('Retention', 'app.jobs.retention', 3);

    // Web and API share one CloudFront URL.
    // The service reports its endpoint as https://host; CloudFront wants the bare host.
    const apiHost = Fn.select(1, Fn.split('//', api.attrEndpoint));

    const site = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    // SPA routing without hiding API 404s.
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var r = event.request; if (!r.uri.includes('.')) { r.uri = '/index.html'; } return r; }",
      ),
    });
    const webHeaders = new cloudfront.ResponseHeadersPolicy(this, 'WebHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy:
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          override: true,
        },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
      },
    });
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      webAclId: props.webAclArn,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: webHeaders,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/v1/*': {
          origin: new origins.HttpOrigin(apiHost, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: { 'X-Origin-Secret': originSecret.secretValue.unsafeUnwrap() },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // GitHub Actions can assume this role only through the production environment.
    const github = new iam.OidcProviderNative(this, 'GitHub', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      assumedBy: new iam.WebIdentityPrincipal(github.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': props.githubSubject,
        },
      }),
      maxSessionDuration: Duration.hours(1),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-af-south-1`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-us-east-1`,
        ],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:us-east-1:${this.account}:parameter/cdk-bootstrap/hnb659fds/version`,
          `arn:aws:ssm:af-south-1:${this.account}:parameter/cdk-bootstrap/hnb659fds/version`,
        ],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [site.bucketArn] }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [site.arnForObjects('*')],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    );
    // The workflow reads the stack outputs to find the bucket and distribution.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [this.stackId],
      }),
    );

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiEndpoint', { value: api.attrEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: users.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: appClient.userPoolClientId });
    new CfnOutput(this, 'SiteBucket', { value: site.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
  }
}
