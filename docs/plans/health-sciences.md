# Plan: UCT Health Sciences batch

Status: proposed. Not built. Waiting for approval.

Source: UCT 2027 prospectus, Health Sciences pages 40–46 (programme descriptions,
band tables, subject minimums), checked from text on 2026-10-24. Every page
will be checked against its image before loading.

## What the prospectus says

Programmes in the batch:

- Bachelor of Medicine and Bachelor of Surgery (MBChB), 240 places.
- BSc Physiotherapy, Occupational Therapy, Audiology, Speech-Language Pathology.
- Higher Certificate in Disability Practice, 30 places.
- Advanced Diploma in Cosmetic Formulation Science, 10 places.

Scoring:

- The Faculty Points Score (FPS) is out of 900. It is the APS plus the three
  NBT scores (out of 300). So every Health band depends on NBT results.
- The Weighted Points Score (WPS) is the FPS weighted by the disadvantage
  factor, which we do not collect.
- Redress thresholds differ by category (redress 1, 2, 3 and 4), for
  example Physiotherapy Band C is 580, 610 or 680 FPS. The app does not
  collect the redress category.

Subject minimums (NSC), for example:

- MBChB: Mathematics and Physical Sciences at 70%, English at 65%, the next
  three best subjects at 70%, and a sub-minimum APS of 450. Band A is 810 FPS
  with NBT Proficient for AL, QL and Mathematics.
- Physiotherapy: Mathematics 60%, Physical Sciences or Life Sciences 65%,
  English 65%, next three 60%, sub-minimum APS 360. Band A is 730 FPS.

## Consequences

1. **Every Health band is unconfirmed under the current decision.** With
   Option A from the NBT plan (no NBT collection), the FPS includes NBT points,
   so every learner gets `qualifies_unconfirmed` for Health. That is honest,
   but it gives no real answer. The app would tell learners "we cannot tell".
2. **Collecting NBT results (Option B) is the real prerequisite.** Health is
   the programme family that depends most on NBT. Before building this batch,
   we need the decision and the privacy work it implies (notice, consent,
   export, delete, retention).
3. **Redress needs a field we do not collect.** Redress category is derived
   from parents' race under apartheid. That is sensitive. Either we collect it
   with consent, or the targeted-redress bands stay unjudged. The plan assumes
   the latter: targeted-redress bands are stored with the lowest threshold for
   reference, and the notes say that thresholds differ by category.
4. **New rule types are needed.** The engine has no "best three subjects at
   X%, next three at Y%" rule and no sub-minimum APS. We would add a
   `best_n` rule (count, minimum percent, and an optional sub-minimum APS).

## Steps

1. **Decide NBT collection.** Owner: you. Blocks step 3 onward for judged
   results. Without a decision, Health rows can still be loaded as unconfirmed.
2. **Add `best_n` and sub-minimum APS to the engine.** Pure function, tests
   for each boundary (exactly 70, 69, sub-minimum exact). One PR.
3. **Extract the batch with image checks.** Render each page 40–46 and read the
   band and subject tables from the image. Record `verified_on` for each row.
   Rows that cannot be read cleanly are left out and listed in the PR.
4. **Load the rows.** Redress thresholds go in `notes`, not in judged bands.
   Non-NSC requirements are not loaded, as in earlier batches.
5. **Checks.** Full API suite, ruff, mypy, seed validation, and new tests for
   the Health verdicts (unconfirmed with and without subjects, and sub-minimum
   APS failing).

## Out of scope

- Non-NSC school-leaving subject tables (IB, A-level, NSSC, IGCSE).
- Redress-specific bands, unless the redress category is collected.
- Foundation programmes and transfer routes.
- AI explanations of Health verdicts beyond the existing explain feature.

## Decision needed

1. Should the app collect NBT results from learners (Option B)? Recommended:
   yes for Health, since without it the Health answer is always "unconfirmed".
   If yes, that needs its own plan for consent and data rights.
2. Should redress category be collected? Recommended: no for now.
