# Hosting

**Context.** App Runner is closed to new customers; AWS recommends ECS Express Mode.

**Decision.** The API image lives in ECR and runs on ECS Express Mode (Fargate + load
balancer), 1–2 tasks, health check `/v1/health`. Scheduled jobs (reminders, retention)
run the same image as ECS tasks through EventBridge Scheduler. The web build is on a
private S3 bucket behind CloudFront with HTTPS. The Android APK is built with EAS.
Deploys run from GitHub Actions using OIDC (no stored AWS keys).

**No custom domain.** The web app uses its CloudFront URL and the API its load-balancer
URL behind CloudFront (so both are HTTPS on one origin). SES sends from one verified
address. SES production access is still required, or codes and guardian links reach only
verified addresses. Guardian emails sent without domain authentication (DKIM on our own
domain) are more likely to land in spam, so the guardian-pending screen tells the learner
to ask their guardian to check spam.

**Consequences.** A deployed walking skeleton is the first milestone, so no deploy
surprise arrives late (`docs/plan.md`).
