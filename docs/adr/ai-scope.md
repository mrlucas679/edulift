# AI scope: four features on one guarded layer

**Status.** Accepted 2026-10-23. Amends the bedrock explanations only decision, which limited AI to verdict explanations.

**Context.** The owner wants four AI features in the hackathon build: verdict
explanations, an "Ask anything" chat, CV and motivation-letter drafting, and isiZulu and
Sesotho explanations. The last three take learner free text or produce text no rules
engine checks, so the guardrails that made the bedrock explanations only decision safe do not cover them.

**Decision.** All four features go through one `AiGateway` in the API: consent check,
rate and cost limits, timeouts, output validation and usage recording. Each feature adds
its own rules on top.

| Feature | Input | Grounding | Output check | Fallback |
|---|---|---|---|---|
| Explain verdict | Verdict data only | The verdict | Numbers and dates ⊆ input; forbidden phrases | Template |
| Ask anything | Learner question (≤ 500 chars) + retrieved records | Only records our database returns for the question (programmes, opportunities, institutions, hand-offs, help articles), passed as delimited data | Every fact cites a retrieved record id; numbers and dates ⊆ retrieved data; refuses eligibility verdicts and points to the verdict screen; no claims of admission | "I can't answer that from EduLift's data" + Khetha hand-off |
| CV / motivation letter | Learner-typed facts (≤ 3000 chars) + the target programme or opportunity | The learner's own text | No invented grades, awards or experience: marks only from stored mark records; draft clearly labelled "Draft — check and edit before you send" | Structured blank template |
| isiZulu / Sesotho | Explanation (as above) | — | Fixed phrases (outcome classes, disclaimers, scam notice) come from human-reviewed string tables; AI output in those languages is labelled "machine-translated" and the English text is one tap away | English |

- Model: Claude Haiku 5.5 on Bedrock (`BEDROCK_MODEL_ID` env var).
  **Changed 2026-10-25:** Claude 5 models aren't enabled on the AWS account ("not available for this account"), so production uses Claude Haiku 4.5 through the global inference profile. Switch back once AWS enables 5.5.
  **Changed 2026-10-27:** Haiku 4.5 needs the Anthropic use-case form submitted in the Bedrock console first. The form was submitted the same day and production went back to Haiku 4.5.
- Consent: `ai_explanations` covers explanations and translations; a separate optional
  `ai_writing` consent covers chat and CV drafting, because those send the learner's own
  words offshore. For a 17-year-old, each requires the guardian to have allowed it.
- Chat and drafting never send the learner's name, email, date of birth or id. The
  drafting screen tells the learner not to type their ID number or contact details and
  strips anything that looks like an SA ID number, email or phone number before sending.
- Stored: chat transcripts are not stored by default. CV and letter drafts are stored
  only when the learner presses Save.

**Consequences.** New endpoints, tables and screens (api.md, data-model.md,
frontend.md). More prompt-injection surface: retrieved data and learner text always go
in delimited fields, the model gets no tools, and its output is never executed or turned
into links (links come only from the retrieved records' allow-listed URLs).
