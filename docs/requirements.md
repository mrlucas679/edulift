# Requirements

Use cases name the actor's goal and enumerate the failure paths, not just the happy path
*(Cockburn, Writing Effective Use Cases — extensions)*. Stories are sized to be built and
verified on their own and follow INVEST *(Cohn, User Stories Applied, ch. 2)*; a story's
acceptance tests correspond to its use case's extensions *(Cohn, User Stories Applied)*.
Quality requirements are written as quality-attribute scenarios — source, stimulus,
artifact, environment, response, response measure *(Bass et al., Software Architecture in
Practice 4e, ch. 3, Figure 3.1)*.

Scope: **the full application.** Every story below ships. The order in
`plan.md` is a build order, not a cut list.

---

## Part A — Use cases

### UC-1 Check where I qualify
**Actor:** Learner (signed in, consent complete). **Goal:** see a verdict for a programme.
**Main success:**
1. Learner opens a programme.
2. System uses the newest mark period, scores with the institution's scheme, runs every check.
3. System shows outcome class, every check (required, yours, pass/fail/unknown), source and checked date, and "based on published minimums; the institution decides".
**Extensions:**
- 2a. No marks → "Add your marks" action; no verdict.
- 2b. Fewer than 6 subjects → outcome `incomplete`, names what is missing.
- 2c. Institution's scheme not verified → score shown as "check your score on their site"; subject checks still run.
- 2d. A requirement value was never confirmed → that check is `unknown`, never pass/fail.
- 2e. Window closed → outcome `closed`; Plan B offered.
- 2f. Marks are Grade 11 / June / prelim → verdict states which period it is based on.

### UC-2 Build my plan
**Actor:** Learner. **Goal:** Plan A verdicts plus Plan B routes.
**Main success:** learner picks up to 3 target programmes → system returns a verdict for each and, for any target not `qualifies*`, Plan B routes (study, TVET, funding, work), max 3 per route, ranked.
**Extensions:** 1a. More than 3 targets → refused with message. 1b. No marks → sent to marks. 2a. A route has no result → route shown with "why nothing matched" and the relevant hand-off.

### UC-3 Get a plain-language explanation
**Actor:** Learner. **Goal:** understand a verdict.
**Main success:** learner taps "Ask about this" → system sends only verdict data to the AI → validated reply shown (summary, next step, Plan B hint).
**Extensions:** 1a. AI consent off → template explanation. 2a. Timeout (8 s), invalid JSON, invented number/date, forbidden phrase → template explanation, no error shown. 2b. Daily limit reached → template explanation and a note.

### UC-4 Create an account (18+)
**Actor:** Learner aged 18+. **Main success:** email → one-time code → date of birth → consents → basics → interests → marks.
**Extensions:** code wrong 3 times → start again; code expired → resend after 30 s; age 17 → UC-5; under 17 → friendly stop screen, Cognito user deleted, nothing stored.

### UC-5 Guardian consent for a 17-year-old
**Actors:** Learner (17), Guardian. **Goal:** lawful consent before the learner's data is stored.
**Main success:**
1. Learner enters date of birth; system computes age 17.
2. Learner enters guardian's name and email; system stores only learner's DOB, guardian email and a pending request.
3. System emails the guardian a single-use link (expires in 72 h).
4. Guardian opens the link (web, no account), reads plain-language notice, declares they are the parent/guardian, chooses which optional purposes to allow, approves.
5. System records guardian consent; learner continues onboarding with only the purposes the guardian allowed.
**Extensions:** 3a. Email fails → learner sees "we couldn't send it" and can correct the address. 4a. Link expired/used → guardian sees "ask the learner to resend". 4b. Guardian declines → learner told politely; pending data deleted. 4c. No response in 7 days → pending data deleted. 5a. Guardian later withdraws via the link in their confirmation email → learner's account restricted to browsing until 18. 5b. Learner turns 18 → learner asked to confirm consents in their own name.

### UC-6 Track an application
**Actor:** Learner. **Main success:** "Add to applications" on a programme/opportunity → tracker entry with default document checklist → learner opens official site (domain shown first) → returns, sets status, reference number, ticks documents, sets offer deadline.
**Extensions:** status set to `submitted` without reference → allowed, flagged "add your reference number"; offer deadline within 7 days → highlighted.

### UC-7 Find funding and work
**Actor:** Learner or visitor. **Main success:** filter opportunities by kind, field, open now → detail shows each criterion met / not met / check with provider, dates, apply link, source, scam notice.
**Extensions:** visitor → criteria shown without personal evaluation; closed → "usually opens in …" if known; no matches → NSFAS + "why nothing matched".

### UC-8 Own my data
**Actor:** Learner. **Main success:** export all data as JSON; delete account (confirm step) → all rows and the Cognito user removed; withdraw any optional consent.
**Extensions:** guardian-consented learner → guardian can also withdraw (UC-5 5a).

### UC-10 Ask EduLift a question
**Actor:** Learner with `ai_writing` consent. **Main success:** learner types a question → system retrieves matching records → AI answers only from them, citing each → answer shown with record cards and source lines.
**Extensions:** no matching records → "I can't answer that from EduLift's data" + Khetha; question asks "do I qualify" → link to the verdict screen; reply cites an unretrieved record or invents a number/date → refusal message; consent off → explains why and links to settings; limit reached → message with reset time.

### UC-11 Draft a CV or motivation letter
**Actor:** Learner with `ai_writing` consent. **Main success:** choose CV or letter and a target → type facts (school, activities, experience, why this programme) → system strips ID/email/phone patterns → draft returned, labelled as a draft → learner edits, saves, copies or shares.
**Extensions:** draft states a mark not stored → rejected, blank structured template offered; provider fails → structured template with the learner's facts placed under headings.

### UC-9 Maintain reference data
**Actor:** Data maintainer. **Main success:** edit YAML → loader validates types, dates, https allow-listed URLs, subject slugs, source on every record → loads.
**Extensions:** any error → loader fails loudly, nothing loaded; record older than freshness period (default 90 days) → flagged in `/v1/meta` and hidden from verdicts if marked unverified.

---

## Part B — User stories and acceptance criteria

IDs are stable; tests reference them (`test_US_ELIG_03_...`).

### Onboarding and identity
| ID | Story | Acceptance criteria |
|---|---|---|
| US-AUTH-01 | As a learner I sign in with an email code so I have no password to leak | Code sent via `/v1/auth/start`; response identical whether or not the address exists; 5/min per email and per IP |
| US-AUTH-02 | As a learner I stay signed in on my phone | Tokens in secure storage; refresh used silently; expired/invalid → clean sign-out |
| US-AUTH-03 | As a learner I can sign out | Refresh token revoked; secure storage and query cache cleared |
| US-AGE-01 | As the system I check age from date of birth | Age computed server-side on every profile write; under 17 → stop screen, Cognito user deleted |
| US-GUARD-01 | As a 17-year-old I ask my guardian to approve | Guardian email sent with single-use 72 h link; only DOB + guardian email stored while pending |
| US-GUARD-02 | As a guardian I approve or decline in plain words | Page states what is collected and why; per-purpose toggles; decline deletes pending data |
| US-GUARD-03 | As a guardian I can withdraw consent later | Withdrawal link in confirmation email; learner restricted to browsing |
| US-GUARD-04 | As a learner turning 18 I take over my own consent | On first sign-in after 18th birthday, consents re-asked in learner's name |
| US-CONS-01 | As a learner I grant or withdraw each purpose separately | `account` required; `ai_explanations`, `ai_writing`, `reminders` optional and off by default; every change writes a consent row with policy version |
| US-PROF-01 | As a learner I give only what matching needs | First name, province, certificate type (NSC/IEB/SACAI), up to 3 interests; no ID number, no income, no race |

### Marks and scores
| ID | Story | Acceptance criteria |
|---|---|---|
| US-MARK-01 | As a learner I enter my marks per period | 0–100 integers; no duplicate subjects; ≥ 6 subjects + LO; aliases normalised to one subject slug |
| US-MARK-02 | As a learner I see a live score preview while typing | Preview values come from `/v1/aps/preview`, never computed in the app |
| US-MARK-03 | As a learner my history is kept | Newest period wins; older periods retained and selectable |
| US-SCORE-01 | As a learner I see my score at each supported institution | One row per institution with scheme name; unverified scheme → "check on their site" |
| US-APS-01 | As a visitor I try the calculator without an account | Nothing stored; 30/min per IP; same marks show different scores at UJ, Wits, UCT |

### Eligibility and plan
| ID | Story | Acceptance criteria |
|---|---|---|
| US-ELIG-01 | As a learner I see a verdict for any programme | Every check listed with required, yours, result, source URL, checked date |
| US-ELIG-02 | As a learner I'm told when a place isn't guaranteed | Selection programmes → `qualifies_selection` |
| US-ELIG-03 | As a learner I'm told exactly how far short I am | `aps_only` names the short subjects and gap; `subjects_only` states points short |
| US-ELIG-04 | As a learner I'm told when a window has closed | `closed` outcome; closing-soon badge when ≤ 14 days |
| US-PLAN-01 | As a learner I choose up to 3 targets | Plan A verdict per target |
| US-PLAN-02 | As a learner I get Plan B when Plan A says no | Routes in order: easier entry same institution → same field other institutions (province first) → TVET → funding → work; max 3 per route; ranking per `rules-engine.md` |

### AI
| ID | Story | Acceptance criteria |
|---|---|---|
| US-AI-01 | As a learner I get a plain explanation of my verdict | ≤ 300 chars each for summary, next step, Plan B hint; English |
| US-AI-02 | As a learner I always get a correct explanation | Any provider failure, invented number/date or forbidden phrase → template; no error shown |
| US-AI-03 | As a learner I control whether AI is used | Without the matching consent (`ai_explanations` or `ai_writing`) no request leaves the API |
| US-AI-04 | As a learner I ask questions about programmes, funding and applications | Answer built only from records EduLift retrieved; each fact links to its record; eligibility questions sent to the verdict screen; unanswerable → "I can't answer that from EduLift's data" + Khetha |
| US-AI-05 | As a learner I get a draft CV or motivation letter for a programme or opportunity | Uses only my typed facts and stored marks; ID numbers, emails, phones stripped before sending; labelled "Draft — check and edit"; saved only when I press Save; copy and share as text |
| US-AI-06 | As a learner I read explanations in isiZulu or Sesotho | Fixed phrases from human-reviewed tables; explanation body labelled "machine-translated"; English one tap away |
| US-AI-07 | As a learner I choose my app language | English, isiZulu, Sesotho in settings; stored in profile |

### Opportunities, applications, saved
| ID | Story | Acceptance criteria |
|---|---|---|
| US-OPP-01 | As a learner I see funding and work I may qualify for | Each criterion met / not met / check with provider; any unknown → "You may qualify — confirm with the provider" |
| US-OPP-02 | As a learner I'm warned about scams | Scam notice on every funding and work detail |
| US-OPP-03 | As a learner I see the NSFAS pre-check | Shown at top of funding; links to NSFAS hand-off |
| US-APP-01 | As a learner I track applications | Statuses: planning, submitted, offer, waitlist, declined, withdrawn; reference no., notes, offer deadline |
| US-APP-02 | As a learner I tick off documents | Default checklist seeded per institution; tick persists |
| US-APP-03 | As a learner I leave safely for the official site | Destination domain shown first; opens in system browser; only allow-listed https domains |
| US-SAVE-01 | As a learner I bookmark programmes and opportunities | Add, list, remove |
| US-DEAD-01 | As anyone I see the next deadlines | Home shows soonest closing windows; red < 7 days, amber < 14, with words not colour alone |
| US-REM-01 | As a learner with reminders consent I'm emailed before saved deadlines | Email 14 and 3 days before close of a saved/tracked item; nothing else is ever sent |

### Data rights and settings
| ID | Story | Acceptance criteria |
|---|---|---|
| US-DATA-01 | As a learner I download all my data | JSON of every row tied to me |
| US-DATA-02 | As a learner I delete my account | Confirm step; all user rows and Cognito user deleted; audit event kept without personal data |
| US-SET-01 | As a learner I use low-data mode | No images in lists, smaller pages, cached reference data |
| US-HELP-01 | As a learner I learn how APS works and get human help | Help screen + Khetha, CAS hand-offs |

### Browsing (no account)
| ID | Story | Acceptance criteria |
|---|---|---|
| US-BROW-01 | As a visitor I browse institutions, programmes, opportunities | Filters: province, type, field, qualification type, open now; page size ≤ 50 |
| US-BROW-02 | As a visitor I see how to apply | Route (direct / CAO / CAS), fee, window, max choices, source |
| US-META-01 | As anyone I see how fresh the data is | Footer shows latest `checked_at` and intake year |

---

## Part C — Quality-attribute scenarios

| ID | Attribute | Source | Stimulus | Environment | Response | Measure |
|---|---|---|---|---|---|---|
| QA-1 | Correctness | Learner | Requests a verdict | Normal | Rules engine output matches the prospectus worked example | 100% of scheme examples pass in CI |
| QA-2 | Availability | Learner | Requests an explanation | Bedrock unavailable | Template explanation | Response < 9 s; 0 errors shown |
| QA-3 | Performance | Learner on 3G | Opens programme detail | Normal load | Verdict rendered | p95 API < 500 ms; screen usable < 3 s |
| QA-4 | Security | Signed-in learner | Requests another learner's application by id | Normal | 404 `not_found` | 0 cross-learner reads in tests |
| QA-5 | Privacy | Any request | Is logged | Normal | No marks, names, emails, DOB, tokens in logs | Automated log-scrub test passes |
| QA-6 | Modifiability | Data maintainer | Adds a new institution with `standard_best6` | Development | Only a YAML file added | 0 code changes |
| QA-7 | Usability | Learner with large font | Opens any screen | Phone font scale 200% | No clipped text | Manual pass on every screen |
| QA-8 | Integrity | Data maintainer | Loads a record without a source | Development | Loader fails, nothing loaded | Loader test passes |
