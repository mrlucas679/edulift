import { Stack, type StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import type { Construct } from 'constructs';

type Props = StackProps & { alertEmail: string; monthlyUsd: number };

export class BudgetStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const email = [{ subscriptionType: 'EMAIL', address: props.alertEmail }];
    const alertAt = (threshold: number, notificationType: 'ACTUAL' | 'FORECASTED') => ({
      notification: { comparisonOperator: 'GREATER_THAN', notificationType, threshold },
      subscribers: email,
    });

    new budgets.CfnBudget(this, 'Monthly', {
      budget: {
        budgetName: 'edulift-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyUsd, unit: 'USD' },
        // Needs the project tag activated in Billing.
        costFilters: { TagKeyValue: ['user:project$edulift'] },
      },
      notificationsWithSubscribers: [alertAt(50, 'ACTUAL'), alertAt(80, 'ACTUAL'), alertAt(100, 'FORECASTED')],
    });
  }
}
