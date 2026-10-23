# Pure rules engine is the only eligibility authority

**Context.** Eligibility is the product's core, and it is where a bug misleads a learner.

**Decision.** `api/eligibility/` is pure Python: marks and reference data in, a verdict
with every check and its source out. It imports no web, database, AWS or clock code;
today's date is a parameter. Each APS scheme is one function that cites its prospectus
page and is tested against that prospectus's worked examples. An unverified scheme is
not offered.

**Consequences.** The app never computes scores or thresholds; even the live preview
calls the API. The AI never decides. Spec: `docs/rules-engine.md`.
