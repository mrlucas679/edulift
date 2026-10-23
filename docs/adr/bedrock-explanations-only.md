# Bedrock for explanations only

**Status.** Amended by the ai scope decision, which adds chat, CV/letter drafting and translations.
The guardrails below still apply to explanations.

**Context.** AI is required in the product. A model that decides eligibility, invents a
requirement or overstates chances would mislead learners.

**Decision.** Amazon Bedrock, called only by the API, only to turn a finished verdict into
`{summary, next_step, plan_b_hint}`. The input contains no personal identifiers and no
learner free text. Cross-Region inference is accepted; it is disclosed and gated by the
optional `ai_explanations` consent (for a 17-year-old, only if the guardian allowed it).
Output is validated; on any failure the template explanation is used.

**Consequences.** The product is complete with AI switched off. Tests run with the
template provider by default. Spend is capped per learner per day and responses are
cached per verdict pattern. Details: `docs/ai.md`.
