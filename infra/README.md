# Infrastructure

Three CDK stacks, all tagged `project=edulift`:

| Stack | Region | What's in it |
|---|---|---|
| `EduLiftSender` | af-south-1 | The SES address sign-in codes come from |
| `EduLift` | af-south-1 | VPC, Postgres, Cognito, the API on ECS Express Mode, S3 + CloudFront for the web app, GitHub deploy role |
| `EduLiftBudget` | us-east-1 | US$50 monthly budget alert (Budgets only lives in us-east-1) |

Every command below needs `-c senderEmail=... -c budgetEmail=...` and an AWS profile.

## First deploy, in order

1. `npx cdk bootstrap aws://<account>/af-south-1 aws://<account>/us-east-1`
2. `npx cdk deploy EduLiftSender`, then click the link AWS emails to the sender address.
   Cognito won't send from an address that isn't verified. Demo email/password accounts
   suppress Cognito's invitation and verification email.
3. `npx cdk deploy EduLift` (builds the API image with Docker, so Docker must be running).
4. `npx cdk deploy EduLiftBudget`
5. In Billing → Cost allocation tags, activate `project`. Until then the budget sees nothing.
   The tag only shows up there about a day after the first tagged resource exists.
6. Ask AWS to move SES out of the sandbox (SES console → Account dashboard). Until then,
   email-code sign-in codes only reach verified addresses. Demo email/password sign-in
   does not send a verification email.

Always `npx cdk diff` before `deploy`.

## Things worth knowing

- Everything sits behind one CloudFront URL: the web app at `/`, the API at `/v1/*`.
  CloudFront adds a secret header. A request without it never reaches the API's logic:
  it gets a 308 back to the CloudFront address, so nobody can skip CloudFront to get round
  the rate limits. It's a redirect, not a 403, because ECS Express rolls a deploy back when
  4xx responses pass 1% during the canary, and scanners hitting the load balancer did that.
- The database is in isolated subnets with no route to the internet. Only the API's
  security group can reach it.
- No NAT gateway. API tasks get public IPs so they can reach Cognito and ECR, but their
  security group only accepts traffic from inside the VPC.
- Without a custom domain, CloudFront uses its default certificate, which still accepts
  TLS 1.0 from old clients. A custom domain with its own certificate fixes that.
- `EduLift` has termination protection, and the database and user pool have deletion
  protection. Removing them is deliberate, two-step work.

After the first deploy, redeploy `EduLift` with `-c appUrl=<SiteUrl output>` so guardian
emails link to the app. Until then the API refuses guardian requests.

## Database role for the API

Run once as the database owner, after the database exists:

```bash
psql -h <db-host> -U edulift -d edulift -v app_password="<new password>" -f infra/db/app_role.sql
```

Store the role's username and password in Secrets Manager, and point the API task at them instead of the owner secret. Migrations keep running as the owner.
