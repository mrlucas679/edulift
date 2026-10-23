# Delivery Plan

The full application ships. This is the build order, not a cut list. Each milestone ends
deployed and demonstrable; `main` stays deployable from M1 on.

**Team.** Two of us write all front-end and back-end code. A third person owns the
submission documents, pitch and demo video, and receives screenshots and the demo script
from us.

## Before code (if hackathon rules forbid pre-written code, only this part happens early)

- Read the full rules: start time, pre-written code, third-party services, IP, submission format.
- GitHub repo `edulift` (empty), branch protection on `main`, both developers added.
- AWS: root MFA, IAM Identity Center users, Budgets alert; verify region (the aws region decision); request SES production access; enable Bedrock model access; create Cognito pool and test one sign-in from the console.
- Expo account for EAS.
- Download prospectuses; fill the tracking sheet; second-person verification (data-sourcing.md).
- Write the six test profiles' expected results by hand.
- Choose accent colour; contrast-check tokens.

## Milestones

| # | Milestone | Done when |
|---|---|---|
| M1 | **Walking skeleton** | App (web + Android) → sign in with email code → API → Postgres → `GET /me` renders on Home. CI green; deployed to AWS by the pipeline |
| M2 | Reference data | Loader + YAML for all 8 institutions; public browse screens (institutions, programmes, opportunities, deadlines, hand-offs); `/meta` footer |
| M3 | Rules engine | All three schemes, checks, outcome classes, test-first against prospectus examples; public APS calculator |
| M4 | Onboarding complete | DOB/age, guardian flow end to end (email, approval page, decline, withdraw, retention job), consents, basics, interests, marks with live preview |
| M5 | Verdicts and plan | Programme verdict screen, My scores, My Plan with Plan B routes, opportunity matching, funding and work screens |
| M6 | AI | `AiGateway` on Claude Haiku 5.5; explanations with template fallback; Ask anything (retrieval-grounded); CV/motivation-letter drafts; isiZulu/Sesotho string tables and translated explanations (the ai scope decision) |
| M7 | Tracking | Applications, checklist, saved, reminders job, external-link flow |
| M8 | Data rights and settings | Export, delete account, consent changes, low-data mode, help, privacy notice |
| M9 | Hardening | All four states on every screen, accessibility pass, security checklist, contrast in both themes, demo accounts seeded, APK built, demo script rehearsed |

Data collection runs in parallel from day 0 and is frozen before M9.

## Rhythm

Small branches, one story or a slice of one per pull request, CI must pass. Every
merge to `main` deploys. First APK at M4, final at M9. Submit early, not at the deadline.

## Demo script (4 minutes, for the pitch owner)

| Time | Beat |
|---|---|
| 0:00 | The problem: "you don't qualify" and they stop there |
| 0:20 | Public APS calculator: same marks, different scores at UJ, Wits, UCT |
| 0:50 | Sign in, age 17 → guardian approves from a phone, consents, marks |
| 1:40 | Plan A says no: `aps_only`, every check with source and date |
| 2:10 | Plan B: easier entry, TVET IT, bursary, learnership, SA Youth — ranked by what's open soonest |
| 2:40 | Ask about this: plain explanation; then AI off — still correct |
| 3:00 | Apply and track: official site, reference number, checklist, deadline |
| 3:30 | Trust: sources, scam notice, guardian consent, delete my data |
| 3:45 | What's next |
