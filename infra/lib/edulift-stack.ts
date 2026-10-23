import * as path from 'node:path';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
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
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

type Props = StackProps & { senderEmail: string; githubRepo: string };

const API_PORT = 8000;

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
      refreshTokenValidity: Duration.days(30),
    });

    // The API refuses requests without this CloudFront header.
    const originSecret = new secrets.Secret(this, 'OriginSecret', {
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });

    const image = new DockerImageAsset(this, 'ApiImage', {
      directory: path.join(__dirname, '..', '..', 'api'),
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
    image.repository.grantPull(executionRole);

    const taskRole = new iam.Role(this, 'ApiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    users.grant(taskRole, 'cognito-idp:AdminGetUser', 'cognito-idp:AdminCreateUser');

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

    const fromSecret = (name: string, secret: secrets.ISecret, key?: string) => ({
      name,
      valueFrom: key ? `${secret.secretArn}:${key}::` : secret.secretArn,
    });

    const api = new ecs.CfnExpressGatewayService(this, 'Api', {
      serviceName: 'edulift-api',
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
        environment: [
          { name: 'EDULIFT_ENV', value: 'demo' },
          { name: 'IDENTITY_PROVIDER', value: 'cognito' },
          { name: 'AWS_REGION', value: this.region },
          { name: 'COGNITO_USER_POOL_ID', value: users.userPoolId },
          { name: 'COGNITO_APP_CLIENT_ID', value: appClient.userPoolClientId },
          { name: 'DB_HOST', value: database.dbInstanceEndpointAddress },
          { name: 'DB_PORT', value: database.dbInstanceEndpointPort },
          { name: 'DB_NAME', value: 'edulift' },
          { name: 'TRUSTED_PROXY_HOPS', value: '2' },
        ],
        secrets: [
          fromSecret('DB_USER', dbSecret, 'username'),
          fromSecret('DB_PASSWORD', dbSecret, 'password'),
          fromSecret('ORIGIN_SECRET', originSecret),
        ],
      },
    });
    api.node.addDependency(executionRole, taskRole, infrastructureRole, database);

    // Web and API share one CloudFront URL.
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
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/v1/*': {
          origin: new origins.HttpOrigin(api.attrEndpoint, {
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

    // GitHub Actions, main branch only.
    const github = new iam.OidcProviderNative(this, 'GitHub', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      assumedBy: new iam.WebIdentityPrincipal(github.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:ref:refs/heads/main`,
        },
      }),
      maxSessionDuration: Duration.hours(1),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
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

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiEndpoint', { value: api.attrEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: users.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: appClient.userPoolClientId });
    new CfnOutput(this, 'SiteBucket', { value: site.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
  }
}
