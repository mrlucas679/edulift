# ADR-0009 — 17-year-olds with guardian consent

**Context.** Most matriculants are 17 when applications open. POPIA treats anyone under
18 as a child, and processing a child's personal information needs the prior consent of
a competent person (s35). An 18+-only product would exclude most of its users.

**Decision.**
- Age is computed server-side from date of birth on every profile write.
- 18+: normal onboarding.
- 17: the learner names a guardian and gives their email. Until the guardian approves,
  only the learner's date of birth, the guardian's name and email, and a pending request
  are stored. The guardian receives a single-use link (valid 72 h), reads a
  plain-language notice, declares they are the parent or legal guardian, chooses the
  optional purposes, and approves or declines. Guardians get no account.
- Under 17: browsing and the public calculator only; no account is kept.
- Unconfirmed requests and their pending data are deleted after 7 days.
- The guardian may withdraw at any time through a link in their confirmation email.
- At 18 the learner confirms consents again in their own name.

**Consequences.** New tables `guardian_requests` and `guardian_consents`, plus new
endpoints and screens. Email verification proves control of a mailbox, not legal
guardianship; the guardian's declaration is recorded. **Confirm this design with a POPIA
practitioner before a public launch.**
