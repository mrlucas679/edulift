# Rules Engine

`api/eligibility/` — pure Python, the only code allowed to say whether someone is
eligible (the pure rules engine decision). Marks and reference data in; a verdict with every check and its
source out. Same input, same answer, every time.

## Inputs and outputs

```python
evaluate_programme(
    marks: MarkSet,              # normalised subject slug -> percent, plus period
    programme: ProgrammeRules,   # min_aps, scheme, requirement groups, selection, special_process
    cycle: CycleWindow,          # opens_on, closes_on, late_closes_on
    certificate: CertificateType,
    today: date,
) -> Verdict

Verdict = {outcome_class, score, scheme, based_on_period, checks: [Check], disclaimers}
Check   = {check, required, yours, result: pass|fail|unknown, source_url, checked_at}
```

## Step 1 — Normalise marks

- Map each entered subject to a catalogue slug via aliases ("Maths", "Mathematics" → `mathematics`).
- Use the newest period with marks; every verdict states "based on Grade 11 / June / prelim / final results".
- NSC level bands live in **one** constant table:

| Percent | 80–100 | 70–79 | 60–69 | 50–59 | 40–49 | 30–39 | 0–29 |
|---|---|---|---|---|---|---|---|
| Level | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

- Fewer than 6 subjects (excluding LO) → outcome `incomplete`. (Input validation at the API already rejects out-of-range and duplicate marks.)

## Step 2 — Score with the institution's scheme

One function per scheme, docstring cites the prospectus page, tests built from that
prospectus's own worked examples. A scheme not yet verified is not offered.

| Scheme | Rule (to be verified against the 2027 prospectus before implementing) | Institutions |
|---|---|---|
| `standard_best6` | Sum of NSC levels of best 6 subjects, LO excluded; max 42 | UJ, UP, TUT, UKZN (confirm each) |
| `wits_best7` | Best 7 including LO (LO capped); bonus weighting for English and Mathematics per Wits table | Wits |
| `uct_fps` | Faculty Points Score: sum of percentages of best 6, LO excluded; faculty-specific weighting (e.g. Science doubles Maths and Physical Sciences) | UCT |

The rule text in this table is a summary from the build plan, **not** a verified source.
The implementing function's docstring must quote the prospectus page it follows.

## Step 3 — Checks per programme

Run every check and record `pass`, `fail` or `unknown`:

1. `score_min` — score ≥ `min_aps` (`unknown` if min_aps or scheme not confirmed).
2. `requirement_group_n` — at least one alternative in group *n* met (one check per group).
3. `window` — `open`, `closing_soon` (≤ 14 days, constant `CLOSING_SOON_DAYS`), `late_only`, `closed`, `not_open_yet`.
4. `certificate` — learner's certificate type accepted.
5. `special_process` — if NBT/portfolio/audition/interview: always `unknown` with "extra selection step" note.

## Step 4 — Outcome class

| Outcome | Rule | Shown to learner |
|---|---|---|
| `incomplete` | fewer than 6 subjects, or no marks | Add these marks to get a result |
| `closed` | window closed (checked before eligibility outcomes, but checks still listed) | You may qualify, but applications for this intake have closed |
| `not_eligible` | score fails AND ≥ 1 group fails | Both score and subjects are short |
| `aps_only` | score passes, ≥ 1 group fails | Your score is enough; these subject marks are short: … |
| `subjects_only` | groups pass, score fails | Your subjects are fine; your score is X short |
| `qualifies_selection` | all pass, selection programme or special process | You meet the minimums; this programme selects, so a place is not guaranteed |
| `qualifies_unconfirmed` | nothing fails, but score or a group is `unknown` | You meet the minimums we could confirm; check the rest with the institution |
| `qualifies` | all pass | You meet the published minimums |

Precedence, first match wins: `incomplete` → `closed` → `not_eligible` → `aps_only` →
`subjects_only` → `qualifies_unconfirmed` → `qualifies_selection` → `qualifies`. Every
verdict carries the disclaimer "Based on published minimums; the institution decides."

## Step 5 — Plan B

When a Plan A target is not `qualifies*`, search in this order and stop at 3 results per route:

1. **Same field, same institution, easier entry**: extended degree → diploma → higher certificate.
2. **Same field, other institutions**: learner's province first, then national.
3. **TVET**: NC(V) or N4 in the same field.
4. **Funding**: bursaries/loans whose criteria are met or unknown for any programme above, plus the NSFAS pre-check.
5. **Work and skills**: learnerships and public-service intakes tagged with the same field, plus SA Youth and DPSA hand-offs.

Ranking inside a route: open before closed → closing soonest first → smallest gap to
requirements → learner's province. Deterministic tie-break by programme name. No AI.

## Opportunity matching

Each criterion → `met`, `not_met`, or `unknown` (data we don't hold, e.g. household
income, race, disability). Any `not_met` → excluded. Any `unknown` → "You may qualify —
confirm with the provider". Never a firm match on unknown.

## NSFAS pre-check

Uses only what we hold: citizenship is not collected, income is not collected → always
"You may qualify — check on NSFAS" with the hand-off; never a firm yes.

## Tests (see testing.md)

Level boundaries (29/30, 39/40, …, 79/80), LO handling, alternatives in a group, each
outcome class, each window state at fixed dates, every scheme against its prospectus
worked examples, Plan B order for fixed profiles.
