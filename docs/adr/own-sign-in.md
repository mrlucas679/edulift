# Own sign-in

**Context.** Cognito email codes need SES production access and, in practice, a domain we
don't have, so real learners couldn't sign in; only the demo worked. Every learner also
had the same access: there was no admin.

**Decision.** The API signs learners in itself (`api/app/routers/auth.py`):

- Username and password, no email. Passwords are 15–128 characters with no composition
  rules, refused when zxcvbn scores them below 3 (its leaked-password lists run on the
  server), and stored as Argon2id at OWASP's minimum (19 MiB, 2 passes, 1 lane), which
  fits a 512 MB task. Sources: `web-application-security-owasp.md` §§10, 13.
- Ten single-use recovery codes at sign-up, stored as SHA-256. A code sets a new password
  and ends every sign-in. Security questions were rejected (Security Engineering 3e,
  ch. 3 §3.4.1).
- Access tokens: 15-minute HS256 JWTs naming only the user; algorithm, issuer and audience
  fixed in code (OWASP §14, RFC 7519 §4.1). Refresh tokens: random, hashed, replaced on
  every use, ending 8 hours after sign-in. The web keeps the refresh token in a `__Host-`,
  HttpOnly, SameSite=Strict cookie (OWASP §11), so a reload stays signed in.
- Roles `student` and `admin` on `users.role`. Admin is granted only by
  `python -m app.jobs.admins` with AWS access; it is read from the database on every admin
  request and ends every sign-in when changed. Admin pages show totals only.
- Guardian approval is a one-time link the learner sends (WhatsApp, SMS), not an email.

**Consequences.** No email anywhere, so no SES dependency and less personal data (POPIA
s10). A forgotten password without codes means a new account. A learner could open the
guardian link and approve for themselves; the decision page records the declaration, and
this needs a POPIA practitioner's view before a public launch. The Cognito pool is kept
(RETAIN, unused) until its ten accounts are dealt with.
