# 04 — Data Model

PostgreSQL 16. Three groups: **reference data** (loaded from `data/`, read-only to the
API), **learner data** (written by the app, always filtered by owner), and **records that
keep us honest** (sources, consents, audit). All ids are UUID unless noted; all
timestamps `timestamptz` in UTC; money in integer cents (`*_zar_cents`).

## Reference data

| Table | Columns | Invariants |
|---|---|---|
| `sources` | id (text slug), title, url, publisher, checked_at (date) | url is https on an allow-listed domain |
| `subjects` | id, slug, name, kind (`language`, `mathematics`, `science`, `other`), is_life_orientation, aliases (text[]) | slug unique; every alias maps to exactly one subject |
| `fields` | id, slug, name, parent_id | two levels (e.g. `it` → `it.software`) |
| `institutions` | id, slug, name, type (`university`, `uot`, `tvet`, `private`), province, apply_url, application_route (`direct`, `cao`, `cas`), fee_zar_cents (nullable), max_choices (nullable), choice_order_matters, late_applications_allowed, aps_scheme (nullable), certificates_accepted (text[]), source_id | null = not confirmed, shown as "check with the institution" |
| `application_cycles` | id, institution_id, intake_year, opens_on, closes_on, closes_at_time (nullable), late_closes_on, response_expectation (nullable text), notes, source_id | closes_on ≥ opens_on |
| `programmes` | id, institution_id, name, qualification_type (`higher_cert`, `diploma`, `degree`, `extended_degree`, `ncv`, `n4`), nqf_level, field_id, min_aps (nullable), aps_scheme_override, selection_programme, special_process (`nbt`, `portfolio`, `audition`, `interview`, null), closes_on_override, duration_years, source_id, verified_by, verified_at | a programme is shown in verdicts only if `verified_at` is set |
| `programme_requirements` | id, programme_id, group_no, subject_id, min_percent | rows sharing group_no are alternatives; every group must be met |
| `opportunities` | id, kind (`bursary`, `scholarship`, `loan`, `learnership`, `internship`, `public_service`, `job_platform`), title, provider, summary, field_ids (uuid[]), opens_on, closes_on, usually_opens (text), apply_url, source_id, status (`open`, `closed`, `rolling`, `unverified`), last_verified_at | `unverified` never shown as a match |
| `opportunity_criteria` | id, opportunity_id, criterion (`min_average`, `subject_min`, `citizenship`, `max_household_income`, `age_min`, `age_max`, `province`, `year_of_study`, `institution_type`, `special_category`), value_json | a criterion we don't collect evaluates to `unknown` |
| `handoffs` | id, slug, name, purpose, url, phone, whatsapp, source_id | NSFAS, CAS, SA Youth, DPSA, Khetha |
| `help_articles` | id, slug, title, body_markdown, language (`en`, `zu`, `st`), reviewed_by, reviewed_at, search_vector (tsvector) | static help, also searched by Ask |
| `default_checklists` | id, institution_id (nullable = generic), label, sort_order | seeds application checklists |

## Learner data

| Table | Columns | Invariants |
|---|---|---|
| `users` | id (= Cognito sub), created_at, deleted_at, status (`onboarding`, `pending_guardian`, `active`, `restricted`) | new accounts start in `onboarding` until date of birth and consent are done; `restricted` = guardian withdrew, browse only |
| `rate_limit_hits` | key (sha256 of bucket + email or IP), window_start, hits | no email or IP stored in clear; old windows deleted on the next hit |
| `profiles` | user_id (PK), first_name, date_of_birth, province, certificate_type (`nsc`, `ieb`, `sacai`), interests (uuid[], ≤ 3), language (`en`, `zu`, `st`), low_data_mode, updated_at | no ID number, income, race, disability |
| `mark_records` | id, user_id, period (`gr11_final`, `gr12_june`, `gr12_prelim`, `gr12_final`), subject_id, percent (0–100), entered_at | unique (user_id, period, subject_id) |
| `saved_items` | id, user_id, target_kind (`programme`, `opportunity`), target_id, created_at | unique (user_id, target_kind, target_id) |
| `applications` | id, user_id, target_kind, target_id, status (`planning`, `submitted`, `offer`, `waitlist`, `declined`, `withdrawn`), external_reference, submitted_on, offer_deadline, notes (≤ 1000), updated_at | the learner's own tracker; EduLift never submits |
| `checklist_items` | id, application_id, label, done, sort_order | |
| `document_drafts` | id, user_id, kind (`cv`, `motivation_letter`), target_kind, target_id (nullable), title, content (≤ 10 000 chars), created_at, updated_at | written only when the learner presses Save |
| `reminders_sent` | id, user_id, target_kind, target_id, threshold_days (14, 3), sent_at | unique (user_id, target_kind, target_id, threshold_days) — idempotent job |

## Guardian consent (ADR-0009)

| Table | Columns | Invariants |
|---|---|---|
| `guardian_requests` | id, user_id, guardian_name, guardian_email, token_hash (sha256), expires_at, status (`pending`, `approved`, `declined`, `expired`), created_at, decided_at | one `pending` per learner; raw token never stored; deleted with pending data after 7 days unconfirmed |
| `guardian_consents` | id, user_id, guardian_request_id, guardian_name, relationship (`parent`, `legal_guardian`), declaration_text_version, purposes (text[]), decision_fingerprint_hash (sha256 of IP + user agent), granted_at, withdrawn_at, withdraw_token_hash | consent valid while `withdrawn_at` is null |

## Records that keep us honest

| Table | Columns | Notes |
|---|---|---|
| `consents` | id, user_id, purpose (`account`, `ai_explanations`, `ai_writing`, `reminders`), granted_by (`learner`, `guardian`), policy_version, granted_at, withdrawn_at | proof of consent (POPIA s11) |
| `audit_events` | id, user_id (nullable after deletion), action (`sign_in`, `marks_changed`, `export`, `delete`, `consent_changed`, `guardian_decision`), target, request_id, created_at | no marks, names, emails in the row |
| `ai_requests` | id, user_id_hash, feature (`explain`, `translate`, `ask`, `draft`), target_kind, target_id, outcome_class, provider (`bedrock`, `template`), fallback_reason, tokens_in, tokens_out, cached, created_at | prompt and reply text are not stored |

## Deletion

`DELETE /v1/me` deletes, in one transaction: profiles, mark_records, saved_items,
applications (+ checklist_items), document_drafts, reminders_sent, consents, guardian_requests,
guardian_consents, then the users row; `audit_events.user_id` set to null and a `delete`
event written. Then the Cognito user is deleted. If Cognito deletion fails, the job
retries; the database deletion is not rolled back.
