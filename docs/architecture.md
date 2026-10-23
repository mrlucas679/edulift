# Architecture

## Quality attributes we optimise for, in order

Architecture tactics answer a named quality attribute *(Software Architecture in
Practice 4e, ch. 3)*. Ours, in priority order:

1. **Correctness of verdicts** — a wrong "you qualify" harms a learner. → Pure, deterministic, test-first rules engine; sourced data; AI kept out of decisions.
2. **Privacy (POPIA)** — learners include 17-year-olds. → Data minimisation, per-purpose consent, guardian consent, no PII to AI or logs.
3. **Availability during judging/peak** — → AI optional with template fallback; public calculator needs no sign-in; deploy on every merge.
4. **Modifiability of reference data** — rules change every cycle. → Institutions are YAML + one scheme function each; new institution on an existing scheme = data only.

## Context

```
 Learner / Visitor / Guardian
        │ HTTPS
        ▼
 ┌───────────────────────┐        ┌──────────────────────┐
 │ EduLift app (Expo)    │        │ Official sites       │
 │ Android · web · iOS   │──────▶ │ universities, CAO,   │
 └──────────┬────────────┘ system │ NSFAS, SA Youth ...  │
            │ HTTPS /v1   browser └──────────────────────┘
            ▼
 ┌───────────────────────────────────────────────────────┐
 │ EduLift API (FastAPI, ECS Express Mode)                │
 │  app/ (web layer) ──▶ services ──▶ eligibility/ (pure) │
 └───┬──────────┬───────────┬──────────┬─────────────────┘
     │          │           │          │
     ▼          ▼           ▼          ▼
  RDS        Cognito      Bedrock     SES
  Postgres   (email OTP)  (explain)   (codes, guardian links, reminders)
```

The API is the only component that touches the database, Cognito, Bedrock, SES and
secrets. The app holds no AWS library and no secret.

## Components and the dependency rule

Source dependencies point inward *(Clean Architecture — the dependency rule;
`free-library/12-open-book-repos/domain-driven-hexagon/README.md`)*.

```
routers ──▶ services ──▶ eligibility (domain, pure)
   │           │
   │           └──▶ ports (interfaces): ExplanationProvider, EmailSender,
   │                Auth, Clock, ReferenceDataRepository, LearnerRepository
   ▼
schemas (Pydantic, wire format)        adapters implement ports:
                                       BedrockExplanationProvider, TemplateExplanationProvider,
                                       SesEmailSender, CognitoAuth,
                                       SqlAlchemy*Repository, SystemClock
```

| Package | Responsibility | May import |
|---|---|---|
| `api/eligibility/` | Mark normalisation, NSC levels, APS schemes, requirement checks, outcome classes, Plan B search, opportunity criteria | Python stdlib only |
| `api/app/services/` | Use-case orchestration: build verdict, build plan, explain, guardian flow, reminders, export/delete | `eligibility`, ports |
| `api/app/adapters/` | AWS and database implementations of ports | boto3, SQLAlchemy |
| `api/app/routers/` | HTTP: validate, authorise, call service, map response | services, schemas |
| `api/app/schemas/` | Request/response models (wire format) | pydantic |
| `api/app/models/` | SQLAlchemy tables | sqlalchemy |
| `client/src/api/` | Typed client + zod schemas generated from OpenAPI | — |

`Clock` is a port so age, closing-soon and deadline logic are testable at fixed dates.

Bounded contexts (module boundaries, not services — one deployable is right for this
team size): **Reference data** (institutions, programmes, opportunities, sources),
**Learner** (profile, marks, consents, guardian), **Eligibility** (verdicts, plans),
**Tracking** (applications, saved, reminders), **Explanation** (AI).

## Runtime flows

**Verdict:** `GET /v1/me/eligibility/programmes/{id}` → load learner marks (newest period)
+ programme, requirement groups, cycle, sources → `eligibility.evaluate(...)` → `Verdict`
(outcome class + checks) → response. No I/O inside `eligibility`.

**Explanation:** verdict → consent check (fail closed) → rate/day limit → cache lookup by
(programme, outcome, check pattern) → `ExplanationProvider.explain(verdict_dto)` with 8 s
timeout → validate (schema, numbers/dates ⊆ input, forbidden phrases) → else template.

**Guardian:** profile write with DOB → age 17 → create `guardian_requests` row (token
hash, 72 h expiry) → SES email → guardian `POST /v1/guardian/decision` → `guardian_consents`
row → learner unlocked for allowed purposes.

**Reminders:** EventBridge Scheduler runs a daily ECS task (`python -m app.jobs.reminders`)
→ for learners with `reminders` consent, saved/tracked items closing in 14 or 3 days →
SES. Idempotent per (learner, item, threshold).

**Retention job:** same scheduler, daily → delete unconfirmed guardian requests older
than 7 days and their pending learner data.

## Deployment (AWS)

| Piece | Service |
|---|---|
| API container | ECR + ECS Express Mode (Fargate + load balancer), 1–2 tasks, health `/v1/health` |
| Scheduled jobs | EventBridge Scheduler → ECS run-task (same image) |
| Database | RDS PostgreSQL 16, smallest burstable, private subnets, encrypted, 7-day backups, deletion protection |
| Sign-in | Cognito user pool, Essentials plan, passwordless email OTP |
| Email | SES (production access requested day 1), verified domain |
| AI | Bedrock, model access enabled in region; cross-Region inference accepted (the bedrock explanations only decision) |
| Web app | S3 (private) + CloudFront, SPA fallback |
| Android | EAS build → APK link |
| Secrets | Secrets Manager / SSM; IAM task role scoped to the actions used |
| Logs/alarms | CloudWatch, 14-day retention, 5xx alarm; AWS Budgets alert |
| CI/CD | GitHub Actions with OIDC to AWS (no stored keys) |

Region: `af-south-1` if RDS, Cognito Essentials, ECS Express, SES and Bedrock are all
available and enabled there; otherwise everything in `eu-west-1`. Never split (the aws region decision).

The library does not cover these AWS services; decisions here rest on AWS documentation.

## Environments

| Env | Database | Auth | AI | Email |
|---|---|---|---|---|
| local | Docker Postgres | Cognito dev pool, or `FakeAuth` | `TemplateExplanationProvider` default | `ConsoleEmailSender` |
| test (CI) | Postgres service container | fake | fake/template | fake |
| demo | AWS | Cognito | Bedrock | SES |
