import { App, Tags } from 'aws-cdk-lib';

import { BudgetStack } from '../lib/budget-stack';
import { EdgeStack } from '../lib/edge-stack';
import { EduLiftStack } from '../lib/edulift-stack';
import { SenderStack } from '../lib/sender-stack';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = 'af-south-1';

function required(key: string): string {
  const value = app.node.tryGetContext(key);
  if (!value) throw new Error(`Missing -c ${key}=...`);
  return value;
}

const senderEmail = required('senderEmail');

// Deploy and verify the sender before the main stack.
new SenderStack(app, 'EduLiftSender', { env: { account, region }, senderEmail });

// WAF for CloudFront must live in us-east-1.
const edge = new EdgeStack(app, 'EduLiftEdge', {
  env: { account, region: 'us-east-1' },
  crossRegionReferences: true,
});

new EduLiftStack(app, 'EduLift', {
  env: { account, region },
  senderEmail,
  appUrl: app.node.tryGetContext('appUrl'),
  githubSubject: 'repo:mrlucas679@210417506/edulift@1430997521:environment:production',
  webAclArn: edge.webAclArn,
  crossRegionReferences: true,
  terminationProtection: true,
});

// Budgets only exists in us-east-1.
new BudgetStack(app, 'EduLiftBudget', {
  env: { account, region: 'us-east-1' },
  alertEmail: required('budgetEmail'),
  monthlyUsd: 50,
});

// Not on the Express service: it copies its tags onto the load balancer, and AWS's
// managed role refuses to create one carrying tags other than its own.
Tags.of(app).add('project', 'edulift', {
  excludeResourceTypes: ['AWS::ECS::ExpressGatewayService'],
});
