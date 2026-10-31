# API Contract

Base path `/v1`. JSON only. OpenAPI is the machine-readable source of truth; this file is
the human summary and must change in the same pull request as the code.

## Conventions

- **Error shape (every error):** `{"error": {"code": "...", "message": "<friendly text>", "request_id": "..."}}`
- **Client IP:** taken from `X-Forwarded-For`, counting `TRUSTED_PROXY_HOPS` entries from the right (2 behind CloudFront + load balancer). Entries further left are written by the caller and ignored.
- **Codes:** `invalid_code` (400), `invalid_credentials` (400), `code_expired` (400), `validation_failed` (422), `unauthenticated` (401), `not_allowed` (403), `not_found` (404), `account_exists` (409), `conflict` (409), `rate_limited` (429), `guardian_consent_required` (403), `upstream_unavailable` (503), `internal_error` (500). No stack traces in responses.
- **Auth:** "Auth" = valid access token from `/auth` (ADR own-sign-in). "Admin" = Auth plus `users.role = admin`. "Public" = reference data or rate-limited anonymous actions. "Link" = single-use guardian token.
- **Ownership:** every `/v1/me/*` query filters by the token's `sub`. Another learner's resource answers `404`, never `403`, so ids can't be probed.
- **Gates:** `/v1/me/*` (except `GET /me`, profile DOB write, guardian request, consents, export, delete) require `users.status = active` and the `account` consent; otherwise `guardian_consent_required` or `not_allowed`.
- **Pagination:** `?page=1&page_size=20`, max 50; response `{items, page, page_size, total}`.
- **Unknown request fields are rejected.** Requests are Pydantic models with ranges and lengths.
- Every response carries `X-Request-Id`.

## Public

| Method + path | Purpose | Notes |
|---|---|---|
| GET `/health` | Liveness + database reachability | |
| GET `/meta` | Latest `checked_at`, intake year, minimum app version, stale-source count | app footer |
| GET `/subjects` | Subject catalogue with aliases | cached |
| GET `/fields` | Field-of-study tree | cached |
| GET `/institutions` | Filters `province`, `type`, `open_now` | |
| GET `/institutions/{slug}` | Detail, cycles, route, fee, max choices, sources | |
| GET `/programmes` | Search `q`, `field`, `institution`, `qualification_type`, `open_now` | verified only |
| GET `/programmes/{id}` | Requirements, closing date, sources | |
| GET `/opportunities` | Filters `kind`, `field`, `open_now` | |
| GET `/opportunities/{id}` | Criteria, dates, apply link, source | |
| GET `/deadlines` | Next windows closing, soonest first | |
| GET `/handoffs` | NSFAS, CAS, SA Youth, DPSA, Khetha | |
| POST `/aps/preview` | Score marks at every supported institution; nothing stored | 30/min per IP |

## Sign-in (own accounts, ADR own-sign-in)

| Method + path | Auth | Purpose | Notes |
|---|---|---|---|
| POST `/auth/register` | Public | username + password → tokens and 10 recovery codes (shown once) | 10 per hour per IP; a weak password → 422 `weak_password` with the rule to follow |
| POST `/auth/login` | Public | username + password → tokens | 10 per 15 min per username, 30 per IP; one `invalid_credentials` reply for any mistake |
| POST `/auth/recover` | Public | username + recovery code + new password → tokens | Code works once; ends every sign-in; 5 per 15 min per username, 20 per IP |
| POST `/auth/refresh` | Public | refresh token (body, or the web's cookie) → new pair | Old refresh token stops working; the sign-in ends 8 h after it began |
| POST `/auth/sign-out` | Auth | Revoke the refresh token, clear the cookie | |
| POST `/auth/password` | Auth | current + new password | Ends every other sign-in |
| POST `/auth/recovery-codes` | Auth | current password → 10 new codes | Old codes stop working |
| POST `/auth/demo` | Public, demo only | A new sample learner, 4-hour token | 20 per 15 min per IP |

`use_cookie: true` (the web app) puts the refresh token in an HttpOnly cookie instead of
the reply.

## Admin

| Method + path | Auth | Purpose |
|---|---|---|
| GET `/admin/stats` | Admin | Account totals and AI calls by feature, provider and fallback reason; no learner details |

## Learner

| Method + path | Purpose | Notes |
|---|---|---|
| GET `/me` | Profile, status, consents, guardian status | creates `users` row on first call |
| PUT `/me/profile` | first_name, date_of_birth, province, certificate_type, interests, low_data_mode | age computed here: <17 → 403 + account deleted; 17 → status `pending_guardian` |
| POST `/me/guardian-request` | `{guardian_name, guardian_email}` → email single-use link | 3/day; replaces a previous pending request |
| GET `/me/guardian-request` | Pending/approved/declined status | |
| POST `/me/consents` | Grant or withdraw one purpose | 17-year-olds: only purposes the guardian allowed |
| GET `/me/marks` | Marks by period | |
| PUT `/me/marks/{period}` | Replace marks for one period | 0–100, no duplicates, ≥ 6 subjects + LO |
| GET `/me/scores` | Score per supported institution | newest period |
| GET `/me/eligibility/programmes/{id}` | Full verdict | |
| POST `/me/plan` | `{target_programme_ids: [≤3]}` → Plan A verdicts + Plan B routes | |
| GET `/me/opportunities/matches` | Funding/work matches with met/unknown criteria | |
| POST `/me/explain` | `{target_kind, target_id, language?}` → `{summary, next_step, plan_b_hint, source: ai|template, machine_translated}` | 10/min, 20/day; `ai_explanations` |
| POST `/me/ask` | `{question ≤ 500}` → `{answer, citations: [{kind, id, title, url, source}], source: ai|refusal}` | 10/min, 30/day; `ai_writing` |
| POST `/me/drafts/generate` | `{kind: cv|motivation_letter, target_kind?, target_id?, facts ≤ 3000}` → `{content, source: ai|template}` | 5/min, 10/day; `ai_writing`; not stored |
| GET, POST `/me/drafts`; GET, PUT, DELETE `/me/drafts/{id}` | Saved drafts | |
| GET `/help` , GET `/help/{slug}` (Public) | Help articles by language | |
| GET, POST `/me/saved`; DELETE `/me/saved/{id}` | Bookmarks | |
| GET, POST `/me/applications` | Tracker list / create from programme or opportunity | seeds checklist |
| GET, PATCH, DELETE `/me/applications/{id}` | Status, reference, offer deadline, notes | |
| PATCH `/me/applications/{id}/checklist/{item_id}` | Tick a document | |
| GET `/me/export` | All my data as JSON | POPIA access right |
| DELETE `/me` | Delete account and all data, including the username and password | confirm token in body |

## Guardian (no account; the age 17 guardian consent decision)

| Method + path | Auth | Purpose |
|---|---|---|
| GET `/guardian/requests/{token}` | Link | What the learner asked for: learner first name, purposes, notice text version |
| POST `/guardian/requests/{token}/decision` | Link | `{decision: approve|decline, guardian_name, relationship, declaration_accepted: true, purposes: [...]}` |
| POST `/guardian/consents/{withdraw_token}/withdraw` | Link | Withdraw consent; learner → `restricted` |

Tokens: 32 random bytes, URL-safe, stored only as SHA-256, single use, 72 h expiry;
endpoints rate limited 10/min per IP. Invalid, used and expired tokens all answer the same
`404`.

## Jobs (not HTTP)

`python -m app.jobs.reminders` and `python -m app.jobs.retention`, run daily by
EventBridge Scheduler.
