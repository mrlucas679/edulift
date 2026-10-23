import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';

export class SenderStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & { senderEmail: string }) {
    super(scope, id, props);
    new ses.EmailIdentity(this, 'Sender', { identity: ses.Identity.email(props.senderEmail) });
  }
}
