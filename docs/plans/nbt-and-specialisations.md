# Plan: NBT levels and per-specialisation programmes

Status: proposed. Not built. Waiting for approval.

## Why

UCT Commerce, Law and Health Sciences require National Benchmark Test (NBT)
levels, for example "Upper Intermediate or above for AL & QL", or "Proficient
for AL". Science and Commerce list separate subject rules for each
specialisation or major (for example Actuarial Science needs Mathematics 80%).
The schema has neither. Loading these rows now would show eligibility the
prospectus does not allow, so nothing is loaded until this lands.

Source: UCT 2027 prospectus, Commerce pages 27–28, Science page 69, Law pages
61–62, Health Sciences pages 40–42. Checked 2026-10-24.

## Decision needed first

Should the app collect NBT results from learners?

- **Option A (recommended for now):** do not collect them. NBT rules are
  shown as "unknown" and the verdict is `qualifies_unconfirmed`. Nothing is
  ever marked pass or fail on NBT. Lowest privacy cost, honest result.
- **Option B:** collect the level per component (AL, QL, MAT) during
  onboarding, with consent and a purpose statement, and judge the rule. This
  needs a privacy notice update and a data-rights check (export, delete,
  retention), and a new learner-data table.

The rest of this plan works with either option. It assumes Option A.

## Steps

1. **NBT requirement type (schema and engine).**
   - Seed: a requirement may name an NBT component and a minimum level
     (`nbt: AL`, `level: upper_intermediate`). Levels are an ordered enum:
     basic < intermediate < upper_intermediate < proficient.
   - Engine: `Option` gains an optional NBT form. With no NBT results, the
     check is `unknown` and the outcome is `qualifies_unconfirmed` when
     nothing else fails. Never `pass`, never `fail`.
   - Tests: unknown NBT never fails; unknown NBT with a failed subject still
     fails the subject; ordering of levels.
   - Migration: none for requirements (JSONB already). Extend the Option
     shape used in `fps_bands.requirements` and `requirements`.

2. **Per-specialisation programmes.**
   - Each Commerce specialisation (for example BCom Accounting, BBusSc
     Actuarial Science) and each Science major becomes its own programme row
     with its own `requirements` and `fps_bands`. Shared rules are copied, not
     inherited, so each row can be checked on its own page.
   - Use an id pattern `uct.<degree>-<specialisation>` and keep names exactly
     as the prospectus prints them.
   - Expect roughly 30 Commerce and 20+ Science rows. Extract in batches of
     one faculty, check each batch against the page image, then load.

3. **Places limits as notes.**
   - Add an optional `notes` text field on programmes, shown as-is. Not used
     by the verdict. Example: Science Note 1 (Biochemistry, Computer Science
     and associated majors, Genetics, Human Anatomy & Physiology limited).

4. **Law and Health Sciences.** Use steps 1–3. Law's Band rules include a
   Law-specific ladder; Health Sciences uses APS with NBT and a 0–20% redress
   range. Each gets its own short plan before extraction.

5. **Verification.** Each batch: read the page image, not only extracted text
   (text extraction garbles some tables). Record `verified_on` for every row.

## Out of scope

- Architectural Studies portfolio score (needs a portfolio field).
- Applicant-specific choices such as foundation programmes, mature-age
  exemptions and transfer routes.
- AI explanations of NBT rules. The AI only explains verdicts the engine
  already gives.

## Tests and checks

- `pytest` full API suite, ruff, mypy, seed validation.
- Unit tests for each new engine path, as listed in step 1.
- One PR per step. Step 1 first, then step 2 per faculty. Nothing merged
  without approval.

## Risks

- A wrong NBT or subject minimum is a wrong verdict for a learner. Mitigated by
  page-image checks and `verified_on`.
- Many near-duplicate rows make later changes error-prone. Mitigated by
  shared-rule tests that check each row's requirements against its page.
