# Security and POPIA

Rule: validate everything that enters, log everything that fails, show the learner only
a friendly message with a request id. Fail closed on token verification, age, guardian
consent and consent lookups.

The library's security material (`free-library/07-security/`, Security Engineering 3e) is
general; POPIA and AWS specifics are not in it — sources are the Act and AWS documentation.

## Threat model (STRIDE, per entry point)

| Threat | Where | Control |
|---|---|---|
| Spoofing a learner | Token on `/v1/me/*` | HS256 pinned in code; issuer, audience and expiry required; user id only from token; Argon2id passwords; login limited per username and IP; one error for any wrong detail |
| Elevation to admin | `/v1/admin/*` | Role read from the database on every request; granted only by `app.jobs.admins` with AWS access; `role` can't be sent to the API; a route inventory test fails if a route becomes public |
| Spoofing a guardian | Guardian link | 32-byte random token, SHA-256 stored, single use, 72 h; declaration recorded; same 404 for invalid/used/expired |
| Learner approving for themselves | Guardian link | **Accepted risk, for POPIA review:** the learner sends the link, so nothing technical stops them opening it. The page requires the guardian declaration and records the decision |
| Tampering | Request bodies | Pydantic with ranges and lengths, unknown fields rejected; marks 0–100 |
| Repudiation | Consent and guardian decisions | `consents`, `guardian_consents`, `audit_events` with policy/declaration version |
| Information disclosure | Cross-learner reads | Owner filter on every query; 404 on others' ids; test per endpoint |
| Information disclosure | Logs, AI | No PII in logs (scrub test); AI gets verdict data only |
| Denial of service / cost | Sign-in, preview, explain, guardian links | Rate limits (api.md), counted in Postgres; Argon2id sized to the task (19 MiB); AI daily cap; budget alarm |
| Elevation | Database | API role without DDL; RDS private; SG allows only the API |
| Phishing / scams | External links | Allow-listed https domains; domain shown before leaving; scam notice |

## Controls

| Area | Control |
|---|---|
| Secrets | Env vars / Secrets Manager only; `.env` git-ignored; `.env.example` names only; IAM task role scoped to the Bedrock model used; `AUTH_SECRET` (token signing) in Secrets Manager |
| Transport | HTTPS only; HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| CORS | Web app origin and local dev origins only |
| Dependencies | Pinned (`uv.lock`, `package-lock.json`); `pip-audit` and `npm audit` in CI; gitleaks on every push |
| Known, accepted (2026-10-23) | npm reports two high advisories with no fixed release: `braces` (via Metro, the bundler: a crafted glob can exhaust the stack; only our own build config feeds it) and `node-forge` (via Expo update code signing, which we don't use). Neither is in the app bundle. CI fails on any other high or any critical. Recheck on every Expo upgrade |
| Session on device | Android: refresh token in the OS keystore via `expo-secure-store`; never AsyncStorage. Web: access token in memory; refresh token in a `__Host-` HttpOnly, Secure, SameSite=Strict cookie that page scripts can't read |
| Email | Off: no route sends email. With no SES sender set, the mailer refuses rather than log an address |

## POPIA checklist

| Section | What EduLift does |
|---|---|
| s10 Minimality | Only what matching needs: first name, DOB, province, certificate type, interests, marks. No ID number, income, race, disability |
| s11 Consent | Per-purpose consent rows with policy version; optional purposes off by default |
| s18 Notification | Privacy notice screen: what, why, who receives it (AWS, Bedrock), rights, contact |
| s19 Safeguards | Encryption in transit and at rest; least privilege; no PII in logs |
| s23–25 Access/correction | Export JSON; edit profile and marks |
| s24 Deletion | Delete account end to end, including username, password hash, recovery codes and sign-ins |
| s26 Special information | Never asked; criteria targeting race/disability show "check with provider" |
| s35 Children | 17-year-olds only with guardian consent (the age 17 guardian consent decision); under-17s cannot create an account |
| s69 Direct marketing | None. Reminders only with consent and only about the learner's own saved items |
| s71 Automated decisions | Every verdict: "based on published minimums; the institution decides" + Khetha |
| s72 Cross-border | Bedrock cross-Region inference disclosed; opt-in (`ai_explanations`, and separately `ai_writing` for learner-typed text, the ai scope decision); no names, contact details or ids; ID/email/phone patterns stripped from typed text. If region is eu-west-1, disclosed in the notice |

**Before a public launch, confirm this design with a POPIA practitioner.**

## Consent and notice texts (draft — plain language)

**Account (required).** "We keep your marks, saved items and applications so EduLift can
match you to programmes, funding and work. You can download or delete them any time."

**AI explanations (optional).** "To explain results in plain language, we send the result
— not your name or contact details — to an AI service that may process it outside South
Africa. You can switch this off any time."

**Reminders (optional).** "We may email you before deadlines you saved. Nothing else."

**Guardian email.** "Hi {guardian_name}. {learner_first_name} (17) wants to use EduLift to
check which university, college, funding and work options they qualify for. Because they
are under 18, the law needs your permission first. Open this link to read what we collect
and approve or decline. The link works once and expires in 72 hours. If you don't know
{learner_first_name}, ignore this email and nothing will be kept."

**Guardian declaration.** "I am {learner_first_name}'s parent or legal guardian, and I
agree to EduLift using their information for the purposes I selected below."

**Under 17.** "EduLift accounts are for people aged 17 and over. You can still use the
APS calculator and browse. Your Life Orientation teacher, the Central Application Service
and the Khetha helpline can help you now."

**Scam notice.** "No real bursary, learnership or university application asks you to pay
to be considered. Never share your ID, banking details or passwords on WhatsApp."
