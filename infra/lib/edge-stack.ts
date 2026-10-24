import { Stack, type StackProps } from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

const managed = (name: string, priority: number): wafv2.CfnWebACL.RuleProperty => ({
  name,
  priority,
  overrideAction: { none: {} },
  statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
  visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: name, sampledRequestsEnabled: true },
});

export class EdgeStack extends Stack {
  readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const acl = new wafv2.CfnWebACL(this, 'Edge', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'edulift-edge', sampledRequestsEnabled: true },
      rules: [
        {
          name: 'rate-per-ip',
          priority: 0,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'rate-per-ip', sampledRequestsEnabled: true },
        },
        managed('AWSManagedRulesCommonRuleSet', 1),
        managed('AWSManagedRulesKnownBadInputsRuleSet', 2),
        managed('AWSManagedRulesSQLiRuleSet', 3),
      ],
    });

    this.webAclArn = acl.attrArn;
  }
}
