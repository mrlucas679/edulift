# 11 — Testing Strategy

Test hardest where a bug would mislead a learner. Write the failing test first, make it
pass simply, then refactor *(Beck, Test-Driven Development By Example)*. Start from an
end-to-end walking skeleton and work outside-in from a failing acceptance test *(Freeman &
Pryce, Growing Object-Oriented Software, Guided by Tests, ch. 4 "Kick-Starting the
Test-Driven Cycle" — "First, Test a Walking Skeleton")*. Mock only the ports we own.

## Layers

| Layer | What | Tool | Gate |
|---|---|---|---|
| Rules engine | Every scheme vs prospectus worked examples; level boundaries 29/30 … 79/80; LO handling; group alternatives; every outcome class and precedence; every window state at fixed dates | pytest | 100% branch coverage of `eligibility/`; CI |
| Plan B | Fixed profiles give expected routes in expected order | pytest + fixtures | CI |
| Opportunity matching | met / not_met / unknown; any unknown → "may qualify" | pytest | CI |
| Seed loader | Missing source, bad URL, unknown slug, closes < opens → loud failure, nothing loaded | pytest | CI |
| API | Per endpoint: happy path, validation error, unauthenticated, another learner's data → 404 | pytest + TestClient + real Postgres (service container) | CI |
| Guardian flow | 17 → pending; approve → active with chosen purposes; decline → data deleted; expired/used token → 404; withdraw → restricted; turning 18 → re-consent; guardian email = learner email refused | pytest with fixed `Clock` | CI |
| Jobs | Reminders idempotent; retention deletes 7-day-old pending data only | pytest with fixed `Clock` | CI |
| AI fallback | Timeout, invalid JSON, invented number, invented date, forbidden phrase, consent off, daily limit → template | pytest, `ExplanationProvider` faked | CI |
| Privacy | Log scrub: no marks/names/emails/DOB/tokens in captured logs across the API suite | pytest | CI |
| Front end units | zod schemas, formatting, components' four states | jest + React Native Testing Library | CI |
| Types and lint | ruff, mypy strict; tsc strict, eslint | — | zero warnings |
| End to end | Demo script on Android and web against the deployed stack; every state triggered once | Manual checklist (Maestro/Playwright if time allows) | before each demo build |
| Accessibility | Contrast of every token pair (light/dark); labels; keyboard on web; 200% font | manual + contrast checker | before demo |
| Security | Secret scan, pip-audit, npm audit, cross-learner manual probe | CI + manual | before final deploy |

## Test profiles (also the demo accounts — fictional data only)

1. **Strong science learner** — qualifies for engineering at most institutions.
2. **Borderline commerce learner** — APS met, Maths 5 points short → `aps_only` + extended programme.
3. **Thandi** — Maths Literacy, wants IT → diploma/TVET Plan B, learnerships, bursary.
4. **First choice closed** — shows `closed` and next open routes.
5. **17-year-old** — guardian flow: pending → approved.
6. **16-year-old** — stopped at age check.

Expected results are written by hand from the prospectuses before the code exists;
those become the acceptance tests.

## Test naming

`test_<story id>_<behaviour>` e.g. `test_US_ELIG_03_aps_only_names_short_subjects`.
