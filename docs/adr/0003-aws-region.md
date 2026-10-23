# ADR-0003 — AWS region

**Context.** Learner data should stay in South Africa where possible. Cape Town
(`af-south-1`) is an opt-in region and not every service or feature may be enabled there.

**Decision.** On day 1, verify RDS PostgreSQL, Cognito Essentials (email OTP), ECS
Express Mode, EventBridge Scheduler, SES and Bedrock in `af-south-1`. If all are
available, deploy everything there. If any is not, deploy everything to `eu-west-1`.
Never split services across regions.

**Consequences.** If `eu-west-1` is used, the privacy notice states that data is stored
outside South Africa (POPIA s72) and the account consent covers it.
