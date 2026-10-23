import { App, Tags } from 'aws-cdk-lib';

import { BudgetStack } from '../lib/budget-stack';
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

new EduLiftStack(app, 'EduLift', {
  env: { account, region },
  senderEmail,
  appUrl: app.node.tryGetContext('appUrl'),
  githubRepo: 'mrlucas679/edulift',
  terminationProtection: true,
});

// Budgets only exists in us-east-1.
new BudgetStack(app, 'EduLiftBudget', {
  env: { account, region: 'us-east-1' },
  alertEmail: required('budgetEmail'),
  monthlyUsd: 50,
});

Tags.of(app).add('project', 'edulift');
