# Cognito passwordless sign-in, proxied by the API

**Context.** No passwords to leak, and the app should carry no AWS library.

**Decision.** Cognito user pool on the Essentials plan (Lite lacks email one-time codes);
sign-in with an email code sent through SES. The API exposes `/v1/auth/start`, `/verify`,
`/refresh` and `/sign-out` and calls Cognito. The API verifies every access token
(signature via JWKS, expiry, issuer, client id, `token_use=access`). Access token 1 h,
refresh token 30 days.

**Consequences.** `users.id` is the Cognito `sub`. Deleting an account deletes the Cognito
user. Guardians never get a Cognito account; they act through a single-use link
(the age 17 guardian consent decision).

**Demo exception.** The submission demo also exposes `/v1/auth/demo/register` and
`/v1/auth/demo/login`. Those routes create independent Cognito users with permanent
passwords and do not send or require an email verification code. They are enabled by
the demo deployment's `DEMO_SECRET`; they do not replace the email-code routes.
