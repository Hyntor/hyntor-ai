# 0012 Sign in with Google, and email verification through it

**Status:** Proposed · **Amends** [0007](0007-authentication.md) · **Date:** 2026-10-27 ·
**Traces to:** A1, A3, T1 · **Issue:** #16 (ACC-3)

## Context

Signing up with a password leaves one question unanswered: can this person actually read mail at the
address they typed? Until that is answered, an account is just a claim. Hyntor needs the answer
before letting anyone near the tutor, because every tutor reply spends the team's AI quota.

The usual answer is a confirmation email, which needs an email provider, a sending domain, a
delivery story and a token flow of its own. Ole Miss runs Google Workspace, so every `olemiss.edu`
and `go.olemiss.edu` address is already a Google account that Google has verified.

## Decision

**Add "Continue with Google" using OpenID Connect's authorization code flow, and treat Google's
`email_verified` claim as the verification step.** A password signup that later signs in with Google
once becomes verified at that moment. No confirmation email is sent by Hyntor at all.

Implemented by hand in [`accounts/google_oauth.py`](../../accounts/google_oauth.py), about 120 lines,
using `google-auth` 2.62.0 to verify the ID token's signature and `requests` 2.34.2 for the token
exchange. Both were checked on PyPI on 2026-10-27.

### What is checked, and why

| Step | Guards against |
| --- | --- |
| `state`, held in a signed `HttpOnly` cookie and compared on return | Someone else's sign-in being completed in this browser (CSRF on the callback) |
| `nonce`, echoed in the ID token | An ID token obtained elsewhere being replayed into our callback |
| Signature verified against Google's published keys | A forged token |
| `email_verified` must be true | A Google account whose address Google has not confirmed |
| Domain must match a registered `University` row | Anyone with a Gmail address signing up (A1) |

**Google proves who you are. It does not decide whether you may join.** The domain rule is applied
exactly as it is for a password signup, after Google has answered.

An account created through Google stores `UNUSABLE_PASSWORD_HASH` (`"!"`) rather than a hash. It is
not valid Argon2, so `verify_password` can never match it, whatever is typed. The password form
refuses such an account with the same message as a wrong password, so the form does not reveal how
an account signs in (T1).

### Not chosen: django-allauth

The obvious library, and the wrong fit here. It depends on `django.contrib.auth`, which
[ADR-0010](0010-stack-python-django.md) deliberately leaves out because Hyntor has its own `User`
and `Session` models from the ERD. Adopting it would mean adopting Django's auth tables as well.
The hand-written flow is also code the team can read aloud in the M4 defense, which allauth's
internals are not.

## Alternatives

- **A confirmation email of our own.** Still the right answer for universities that do not use
  Google, and it remains open as follow-up work. Rejected as the *first* step because it needs an
  email provider and a sending domain, and Google covers the only university currently registered.
- **Trusting any Google account.** Rejected: it would bypass A1 entirely.
- **Treating any successful Google sign-in as verified, without checking `email_verified`.** Google
  issues accounts for unverified addresses, so this would verify nothing.

## Consequences

- **Password accounts at a non-Google university still cannot verify themselves.** An administrator
  sets `email_verified_at` by hand until a confirmation email exists. This is the main gap, and the
  reason this ADR does not close #16 on its own.
- **Two sign-in routes to one account.** A password account and a Google sign-in at the same address
  are the same user, matched on email. That is intended, and the test suite covers it.
- **Google is a dependency of signing in**, though not of the site: if Google is unreachable, the
  password form still works.
- **The redirect URI must be registered in Google Cloud Console for each host**, including
  `localhost:8000` for development. A mismatch is the most common cause of a failed sign-in.
- Leaving the credentials unset hides the button, so development and CI need no Google account.
