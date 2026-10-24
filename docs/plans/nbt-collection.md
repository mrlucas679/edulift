# Plan: collect NBT results with consent

Status: proposed. Not built. Waiting for approval.

## Why

Health Sciences, Commerce, Law and Science rules use NBT levels (AL, QL,
Mathematics). Without results, every such verdict is "unconfirmed". Collecting
results lets the engine answer those rules. Health's FPS also includes NBT
points, so Health bands can only be judged with results.

## What we would collect

- Level per component: AL, QL and MAT, each one of basic, intermediate,
  upper_intermediate or proficient, as printed on the NBT result.
- Optional: the NBT result date and which sitting. Not required for judging.
- Not collected: raw test scores or item responses. The engine only needs the
  level.

Not collected, by design: race, redress category, disability, or any other
special personal information (POPIA s26). This follows
[docs/security.md](../security.md): "Never asked". Health's redress bands stay
unjudged.

## Consent

- A new optional purpose, `nbt_results`, off by default, separate from
  `account`, `reminders` and `ai_*`. Stored like the other purposes: one
  `consents` row per change, with policy version.
- Plain-language wording, shown at the point of entry: "Your NBT levels let us
  check Health, Commerce and Law rules. Without them we can only say 'unconfirmed'.
  You can skip this and still use the rest of the app."
- Withdrawing deletes the stored levels, not just the flag.
- Guardian rule applies: for learners under 18, the guardian chooses this
  purpose (age 17 guardian consent ADR).

## Where it appears in the app

- **Onboarding (new step after marks):** optional, skippable, one screen per
  component, with a "I don't have this yet" option.
- **My marks:** an NBT section to add, edit or remove levels.
- **Settings:** the purpose toggle; turning it off deletes the levels.
- **Programme page:** when a verdict is unconfirmed only because NBT is missing,
  show "Add your NBT results to check this rule" linking to My marks, instead of
  silently showing unconfirmed.

## Privacy notice

Update the draft notice (`app/privacy.tsx`) with:
- what NBT levels are, why they are needed, and that they are optional;
- retention: kept until the learner deletes them or withdraws consent, and
  erased with the rest of the learner's data;
- that EduLift never sends NBT levels to an AI provider. The AI explains
  verdicts from the engine's output only, and the NBT level is not in the
  prompt. Checked against [docs/ai.md](../ai.md) before build.
- the same plain-language review as other purposes. A POPIA practitioner review
  is still open (Q10 in [docs/open-questions.md](../open-questions.md)).

## Data rights

- **Export:** `export_learner` includes `nbt_records`, as it does `mark_records`.
- **Erase:** `erase_learner` deletes `nbt_records`. Covered by the existing
  erasure test pattern.
- **Withdrawal:** deleting the purpose deletes the rows in the same
  transaction; a test checks that nothing remains.
- **Audit:** consent changes write audit events, with no NBT values in logs.
- **Retention:** no separate retention job. Rows follow the learner's
  account lifecycle, same as marks.

## Data model and API

- Table `nbt_records`: user_id, component, level, recorded_on, timestamps.
  Unique per (user, component). Rows always filtered by the signed-in user's id.
- Endpoints: `GET /v1/me/nbt`, `PUT /v1/me/nbt/{component}`,
  `DELETE /v1/me/nbt/{component}`. Pydantic models with strict extra fields.
- The verdict endpoint reads the learner's NBT levels only when the purpose is
  granted; otherwise every NBT check stays unknown.
- Engine: NBT checks become pass or fail when a level is present.
  Rules use `level >= required` on the ordered list. Tests for each level pair.

## Security

- Parameterised queries only (matches the existing SQL rules).
- Rate limit on writes, like the other learner writes.
- Object-level authorisation tests: user A cannot read or change user B's levels.
- No NBT values in logs or error messages.

## Steps (each its own PR)

1. Consent purpose `nbt_results`, privacy notice text and onboarding step (API
   + app).
2. Table, migration, endpoints, export and erase, with tests.
3. Engine: NBT levels judged when present; tests for each level.
4. My marks and Settings screens; programme page prompt.
5. Full checks: API suite, ruff, mypy, mobile tests, security tests, and a
   manual run on the emulator.

## Out of scope

- Raw NBT scores and test reports.
- Redress category (POPIA s26; see above).
- Automatic import of NBT results from UCT or NBT systems.
- Verifying a learner's NBT result against the NBT system.

## Risks

- Learners may enter wrong levels. Mitigated by showing the level and date
  they entered, with a "check your result slip" note.
- Sensitive-looking data: NBTs are not special personal information, but they
  reveal academic performance. Mitigated by the purpose being optional and off
  by default.

## Decisions needed

1. Approve collecting NBT levels as an optional purpose, off by default?
2. Approve the onboarding step being skippable with no penalty in the rules
   (unconfirmed, not fail)?
3. Confirm the privacy notice wording goes to a POPIA practitioner before any
   public launch (already open as Q10).
