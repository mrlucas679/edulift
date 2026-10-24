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
