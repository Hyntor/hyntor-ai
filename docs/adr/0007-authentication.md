# 0007 Authentication: own sessions + Argon2id

**Status:** Proposed, amended by [0010](0010-stack-python-django.md) · **Issue:** #5 · **Traces to:** A1-A6, N5

## Context

Users sign up with a university email (A1) and stay signed in through a cookie. Auth code is part of the oral
defense, so every member must be able to explain it end to end.

## Decision

- **Passwords:** Argon2id via **`@node-rs/argon2`** (2.2.2, MIT, checked on npm 2026-10-19). It ships
  prebuilt binaries, so `npm ci` needs no C++ toolchain on Windows or in CI.
- **Sessions:** our own `Session` table. A random 256-bit token goes in the cookie; only its SHA-256 hash
  (`tokenHash`) is stored. Logout deletes the row.
- **Cookie:** `HttpOnly`, `SameSite=Lax`, `Secure` in production.

## Alternatives

- **`argon2` (node-argon2)**: equally sound, but builds from source when no prebuild matches.
- **Auth.js / Lucia / Clerk**: less code, but the session model becomes a library's, and a hosted service puts
  user data outside our database.
- **JWTs**: cannot be revoked on logout without a denylist, which is a session table again.

## Consequences

- Login throttling (ACC-4) and enumeration-safe errors are ours to build and test.
