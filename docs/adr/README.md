# Architecture Decision Records

One record per decision. Status is `accepted` unless stated. A superseded record stays,
marked `superseded by ADR-xxxx`. Format: Context, Decision, Consequences.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-standalone-repository.md) | EduLift is a standalone repository | accepted 2026-10-23 |
| [0002](0002-expo-router-typescript.md) | Expo Router + TypeScript for Android, web, iOS | accepted 2026-10-23 |
| [0003](0003-aws-region.md) | AWS, one region: af-south-1, else eu-west-1 | accepted 2026-10-23 |
| [0004](0004-fastapi-python.md) | FastAPI on Python 3.12 | accepted 2026-10-23 |
| [0005](0005-rds-postgresql.md) | Amazon RDS for PostgreSQL | accepted 2026-10-23 |
| [0006](0006-bedrock-explanations-only.md) | Bedrock for explanations only; cross-Region accepted with opt-in | amended by 0012 |
| [0007](0007-cognito-passwordless.md) | Cognito Essentials, passwordless email OTP, proxied by the API | accepted 2026-10-23 |
| [0008](0008-institution-scope.md) | 6 universities + 2 Gauteng TVET colleges | accepted 2026-10-23 |
| [0009](0009-age-17-guardian-consent.md) | 17-year-olds allowed with guardian email consent | accepted 2026-10-23 |
| [0010](0010-pure-rules-engine.md) | Pure-Python rules engine is the only eligibility authority | accepted 2026-10-23 |
| [0011](0011-hosting.md) | ECS Express Mode for the API, S3 + CloudFront for web, EAS for Android | accepted 2026-10-23 |
| [0012](0012-ai-scope.md) | Four AI features (explain, ask, CV/letter, isiZulu/Sesotho) on one guarded gateway; Claude Haiku 5.5 | accepted 2026-10-23 |
