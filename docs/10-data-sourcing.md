# 10 — Data Sourcing and Verification

Data quality decides whether judges and learners trust EduLift. Collect by hand from
official pages only — never from UniApplyForMe, aggregators or SEO guide sites.

`South_African_Universities_2027_Application_Reference.pdf` (snapshot 6 October 2026) is
a starting point for institution windows and routes, not a source to load: every value is
re-checked against the institution's own page or prospectus.

## Datasets

| Dataset | Target | Official source | Fields |
|---|---|---|---|
| Subjects | All NSC subjects (~40) + IEB names | DBE subject list | slug, name, kind, aliases |
| Fields of study | ~25 top-level, ~60 sub-fields | our taxonomy | slug, name, parent |
| Universities | UJ, Wits, UP, TUT, UCT, UKZN (CAO) | 2027 undergraduate prospectus PDFs | route, fee, max choices, scheme, cycle dates, response expectation |
| TVET colleges | 2 in Gauteng | college sites, DHET TVET list | programmes, entry level, dates |
| Programmes | 15–25 per university, 6 fields, incl. extended and higher certificate | prospectuses | min APS, requirement groups, selection, special process, closing override, page number |
| Bursaries and loans | 30–40, open or rolling | funder websites | criteria, dates, apply URL |
| Learnerships / internships | 10–15 | SETA and employer pages | criteria, dates, apply URL |
| Public service | SAPS trainee, SANDF MSDS, DPSA circular | saps.gov.za, dod.mil.za, dpsa.gov.za | season, requirements, how to apply |
| Hand-offs | NSFAS, CAS, SA Youth, DPSA, Khetha | their sites | URL, phone, WhatsApp |
| Document checklists | per institution | application pages | labels |

## File format

One YAML file per institution in `data/institutions/`, plus `subjects.yaml`,
`fields.yaml`, `opportunities/*.yaml`, `handoffs.yaml`, `sources.yaml`. Shape: see the
build plan PDF §"Example record". Every record names a `source` id.

## Verification rules

1. Every record has a source with URL and `checked_at`; the loader rejects records without one.
2. A second person checks each programme's APS and subject minimums against the PDF and
   records `verified_by` and `verified_at`. Unverified programmes never appear in verdicts.
3. The loader validates types, dates (closes ≥ opens), URLs (https, allow-listed domain),
   known subject slugs, requirement groups non-empty — and fails loudly, loading nothing.
4. A value we could not confirm is left out, not guessed; the app shows "check with the institution".
5. Response times are stored only where officially published (e.g. UNISA); otherwise the
   app says "No fixed response time published" and offers reminders.
6. Freshness: sources older than 90 days are flagged in `/v1/meta`; refresh before every cycle.
7. Dataset frozen before the final demo build; only corrections after that.

## Tracking sheet columns

institution · programme · qualification type · min APS · requirement groups · selection ·
special process · closing date · source URL · page number · collected by · verified by · date.
