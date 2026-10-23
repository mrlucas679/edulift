# Open Questions

Each answer becomes an ADR or a change to the relevant document.

## Open

| # | Question | Blocks |
|---|---|---|
| Q2b | Monthly AWS budget alert amount for the existing account | M1 deploy |
| Q11 | Region check: are RDS, Cognito Essentials, ECS Express, EventBridge Scheduler, SES and Bedrock (Claude Haiku 5.5) all available in `af-south-1` on this account? (verified in M1) | ADR-0003 outcome |
| Q12 | Who reviews the isiZulu and Sesotho fixed-phrase tables? | US-AI-06 |
| Q10 | POPIA practitioner to review ADR-0009 and ADR-0012 before a public launch | Public launch (not the hackathon) |

## Answered 2026-10-23

| # | Answer | Recorded in |
|---|---|---|
| Q1 | Code may be written now | 12-delivery-plan.md |
| Q2 | Owner's existing AWS account, separated by tags and its own budget | 03-architecture.md |
| Q3 | All four AI features: explanations, Ask anything, CV/motivation letter, isiZulu/Sesotho | ADR-0012 |
| Q4 | Claude Haiku 5.5 on Bedrock | ADR-0012 |
| Q5 | Central Johannesburg TVET College, South West Gauteng TVET College | ADR-0008 |
| Q6 | Deep teal accent, Atkinson Hyperlegible | 07-frontend.md |
| Q7 | `mrlucas679/edulift`, public | ADR-0001 |
| Q8 | Android APK + web | ADR-0002 |
| Q9 | No custom domain; AWS default URLs, one verified SES address | ADR-0011 |
