import { App, Tags } from 'aws-cdk-lib';

import { BudgetStack } from '../lib/budget-stack';
import { EduLiftStack } from '../lib/edulift-stack';
import { SenderStack } from '../lib/sender-stack';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = 'af-south-1';

function required(key: string): string {
  const value = app.node.tryGetContext(key);
  if (!value) throw new Error(`Pass -c ${key}=... (see infra/README.md)`);
  return value;
}

const senderEmail = required('senderEmail');

// Deploy order matters: the sender address has to be verified (someone clicks the link
// AWS emails) before Cognito will agree to send mail from it.
new SenderStack(app, 'EduLiftSender', { env: { account, region }, senderEmail });

new EduLiftStack(app, 'EduLift', {
  env: { account, region },
  senderEmail,
  githubRepo: 'mrlucas679/edulift',
  terminationProtection: true,
});

// AWS Budgets is a global service that CloudFormation only offers in us-east-1.
new BudgetStack(app, 'EduLiftBudget', {
  env: { account, region: 'us-east-1' },
  alertEmail: required('budgetEmail'),
  monthlyUsd: 50,
});

Tags.of(app).add('project', 'edulift');
