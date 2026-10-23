# M1 — Walking Skeleton

The thinnest end-to-end slice that is built, tested and deployed automatically: app →
sign in with an email code → API → PostgreSQL → `GET /v1/me` rendered on Home *(Freeman &
Pryce, GOOS ch. 4, "First, Test a Walking Skeleton")*. Everything later hangs off it.

## Done when

1. On the web build and an Android APK, a person signs in with an email code and Home
   shows "Signed in" with their account id, read from `GET /v1/me` (row created in Postgres).
2. Sign-out clears the session; an expired or forged token answers 401 and the app
   returns to sign-in.
3. CI on every pull request: ruff, mypy strict, pytest against a Postgres service, tsc,
   eslint, secret scan — all green.
4. Merge to `main` deploys the API to ECS and the web build to S3/CloudFront, using OIDC.
5. `GET /v1/health` reports database reachability on the deployed URL.

## Steps

| # | Step | Output |
|---|---|---|
| 1 | Repository | `git init`, `.gitignore`, `.editorconfig`, `.env.example` (names only), README setup, push to `mrlucas679/edulift`, branch protection on `main` |
| 2 | Local stack | `docker-compose.yml` with PostgreSQL 16 for local dev and tests |
| 3 | API skeleton (Python 3.12, uv) | App factory; settings from env; request-id middleware; JSON logs without PII; one error shape; `/v1/health`, `/v1/meta` stub |
| 4 | Persistence | SQLAlchemy engine/session; Alembic baseline with `users`; `LearnerRepository` port + SQLAlchemy adapter |
| 5 | Auth | `IdentityProvider` port; `CognitoIdentityProvider` (USER_AUTH flow with EMAIL_OTP; verify access token via JWKS); `FakeIdentityProvider` for tests and local; `/v1/auth/start`, `/verify`, `/refresh`, `/sign-out`; `GET /v1/me` creates the user row |
| 6 | API tests | health; `/me` 401 without token, 401 with forged/expired token, 200 creates row once; auth start always the same reply; error shape; log scrub |
| 7 | App skeleton (Expo Router, TS strict) | theme tokens (teal, Atkinson Hyperlegible, spacing); `AppScreen`, `Button`, `ErrorState`; typed API client + zod; React Query; secure-store session; Email → Code → Home; sign-out |
| 8 | CI | `.github/workflows/ci.yml` |
| 9 | AWS (existing account) | Check service availability in `af-south-1` (Q11) and pick region; infrastructure as code in `infra/` (AWS CDK, TypeScript): Cognito pool (Essentials, email OTP), SES identity, RDS, ECR, ECS Express service, S3 + CloudFront, GitHub OIDC role, Budgets alert, all resources tagged `project=edulift` |
| 10 | Deploy | `deploy-api.yml` (build → ECR → migrate → ECS), `deploy-web.yml` (expo export → S3 → invalidate); first EAS Android build |

## Status (2026-10-23)

Steps 1–8 done and checked against a running API and the web build in a browser:
email code → tokens → `/v1/me` creates the account → sign-out revokes the refresh
token. Added beyond the plan, because `/auth/start` sends a real email per call: rate
limits on start and verify, counted in Postgres. Not yet done: step 9 (AWS) and step 10
(deploy workflows, first Android build). On web the session is kept in memory only, so
a reload signs you out; refreshing an expired access token mid-session comes with M4.

Steps 1–8 need no AWS. Step 9 creates billable resources in the owner's account and
waits for explicit approval of the CDK diff before `cdk deploy`.
