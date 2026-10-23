# 01 — Product Brief

## Problem

Every year thousands of South African matriculants hear "you don't qualify" and stop
there. Admission rules differ per institution and per programme (three different APS
schemes among six large universities alone), deadlines are scattered across 26 university
sites, CAO and TVET colleges, and funding, learnerships and public-service intakes live on
yet more sites. A learner who misses Plan A rarely sees the Plan B that was open to them.

## Who it is for

| Actor | Goal |
|---|---|
| **Learner** (Grade 12 or completed matric, aged 17+) | Know where I qualify, what to do if I don't, and never miss a deadline |
| **Guardian** (of a 17-year-old learner) | Approve, in plain words, that my child's information may be used |
| **Visitor** (no account) | Try the APS calculator and browse institutions, programmes and opportunities |
| **Data maintainer** (team) | Keep every requirement, date and opportunity correct and sourced |

Under-17s can browse and use the public calculator; they cannot create an account.

## Outcomes

1. A learner enters marks once and sees, per programme, a verdict with every check, its
   source and the date it was checked.
2. A "no" on Plan A always opens Plan B: easier entry at the same institution, the same
   field elsewhere, TVET, funding, work and skills — ranked by what is open soonest.
3. The learner applies on the official site and tracks status, reference number,
   documents and offer deadline in EduLift.
4. AI turns a verdict into two or three plain sentences and one next step, and the
   product still works completely with AI switched off.

## What EduLift is not

- Not an application submitter. It never submits, never stores another site's password.
- Not an admissions oracle. Meeting published minimums does not guarantee a place.
- Not an aggregator copy. Data comes only from official pages, never from UniApplyForMe
  or SEO guide sites.

## Coverage

6 universities — **UJ, Wits, UP, TUT, UCT, UKZN (via CAO)** — and **2 Gauteng TVET
colleges — Central Johannesburg TVET College and South West Gauteng TVET College**, with 15–25 programmes per university across IT, engineering, health,
commerce, education and humanities, including extended and higher-certificate options.
30–40 bursaries/loans, 10–15 learnerships/internships, SAPS, SANDF MSDS, DPSA, and
hand-offs to NSFAS, CAS, SA Youth, DPSA and Khetha. See ADR-0008.

## Glossary (ubiquitous language — use these words in code, API and screens)

| Term | Meaning |
|---|---|
| Learner | The person whose marks are being checked |
| Guardian | Parent or legal guardian who consents for a 17-year-old learner |
| Mark record | One subject's percentage for one period (gr11_final, gr12_june, gr12_prelim, gr12_final) |
| NSC level | 1–7 achievement level derived from a percentage |
| APS scheme | An institution's method for turning marks into a score (`standard_best6`, `wits_best7`, `uct_fps`) |
| Programme | A qualification at an institution (degree, extended degree, diploma, higher certificate, NC(V), N4) |
| Requirement group | A set of alternative subject minimums; one alternative per group must be met |
| Check | One evaluated rule: required, learner's value, `pass` / `fail` / `unknown`, source |
| Verdict | All checks for one learner × one programme, plus an outcome class |
| Outcome class | `qualifies`, `qualifies_selection`, `qualifies_unconfirmed`, `aps_only`, `subjects_only`, `not_eligible`, `closed`, `incomplete` |
| Plan A | Up to three target programmes the learner chose |
| Plan B | Ranked fallback routes: study, TVET, funding, work |
| Opportunity | Bursary, scholarship, loan, learnership, internship, public-service intake or job platform |
| Hand-off | A trusted external service EduLift sends the learner to (NSFAS, CAS, SA Youth, DPSA, Khetha) |
| Application | The learner's own tracker entry; EduLift never submits it |
| Source | An official page or PDF, with URL and the date it was checked |
| Explanation | Plain-language text for one verdict, from AI or from the template |
