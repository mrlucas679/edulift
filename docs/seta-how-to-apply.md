# SETA and funding: how to apply (checked 2026-10-24)

Only what was seen on the pages below is recorded. Anything marked "not checked" needs a visit before it goes into the app.

## Verified entry points

| SETA | Where learners go | What was seen on the page |
|---|---|---|
| AgriSETA | https://www.agriseta.co.za/learnerships/ | A learnership is a vocational programme that combines theory and practice and ends in a SAQA-registered qualification. Vacancies at /vacancies-2/. Registered learnerships at /registered-agriseta-learnerships/. Page does not list entry requirements. |
| BANKSETA | https://bankseta.org.za/vacancies/ | Vacancies page. Discretionary grants for unemployed learners (bursaries) at /discretionary-grants/. |
| CATHSSETA | https://www.cathsseta.org.za/vacancies | Current and archived vacancies. Learner portal at https://www.cathsseta.org.za/learner_portal |
| CETA | https://www.ceta.org.za/learner-portal | Learner portal. Page was unavailable when checked ("temporarily unavailable"), so not confirmed. |
| EWSETA | https://ewseta.org.za/ads/ and https://integreat.ewseta.org.za/ | Vacancies. Discretionary grant application portal and user guide. Workplace application at /workplaceApplication. DG funding policy 2025-2026 (PDF). |
| ETDP SETA | https://www.etdpseta.org.za/edu/vacancies | Vacancies page. |
| FoodBev | https://foodbev.co.za/what-we-do/skills-development-funding/ | Mandatory and discretionary grants described. |
| FP&M SETA | https://www.fpmseta.org.za/ | Vacancies. **Do not use** the "NSFAS Application Drive" link: it points to wp25.domains.co.za, which is not an official SETA domain. |
| FASSET | https://www.fasset.org.za/ | Homepage opened; learnership pages not yet read. |
| HWSETA, INSETA, LGSETA, MICT, MQA, Services SETA, TETA, W&RSETA, CHIETA | homepage | Opened; funding and learnership pages not yet read. |
| MerSETA | https://www.merseta.org.za/ | Homepage opened; POPI notice is shown on first visit. Learnership pages not yet read. |

## Not checked

- **PSETA:** the browser refused the site.
- **SASSETA:** a bot-check page blocked it.
- **ESSA:** the site would not load.
- **ISFAP:** not on the DHET homepage; no working page found.

## Government funding warnings (DHET, 2026)

DHET published statements about delayed SETA bursary allowances and delayed Funza Lushaka payments. Tell learners that payments can be late, and that they should check status through the institution or funder.

## What a learner needs (general, not per SETA)

Requirements differ by SETA and programme. None of the pages above listed a full requirement set, so the app should show "check the SETA's requirements" for now. Before adding a list per SETA, read that SETA's current learnership or bursary call and record the requirements, closing date and source page.

## How the app should use these links

1. Show the SETA's own page as the apply link, not a copy of its rules.
2. Label each link with what it is (vacancies, learnerships, grants, portal) and when it was checked.
3. Only send learners to hosts on the allowlist in `api/app/seed.py`.
4. Never ask learners for a password or ID number on our side; they enter those on the SETA portal.

## Requirements and dates read on 2026-10-24

- **MerSETA, approved learnerships (PDF, 2026/09):** 32 approved learnerships with NQF level, credits and SAQA ID. The PDF gives no closing date and no entry requirements. Loaded as `merseta-learnership-01` to `32`.
- **BANKSETA, bursaries for unemployed learners:** applications come from public universities and universities of technology, not from individuals. Closing date 13 November 2026, 16:00, submitted through BANKSETA's SIMS portal. The window page also shows 17 November 2026 as the closing date, so the earlier date is used. Briefing session 22 October 2026. Loaded as `bankseta-unemployed-learners-bursaries`.
- **AgriSETA, discretionary grants (FY 2027/28):** the SETA does not accept applications from individuals. Learners apply through an employer or an accredited training provider. Window dates are not on the page.
- **FoodBev, mandatory grants:** for levy-paying employers only. The page's deadline is for 2024/25 and is out of date.
- **CATHSSETA vacancies:** no openings when checked. These pages are for SETA staff, not learners.
- **ETDP SETA vacancies:** staff jobs, hosted on an external recruitment site that is not on the allowlist. Not added.

## Pattern

Most SETA money goes through employers and training providers, not learners. The app should tell learners to ask their employer or a training provider to apply for them, and should not present SETA pages as individual application forms.
