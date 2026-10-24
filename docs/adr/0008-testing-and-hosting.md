# 0008 Test runner and hosting target

**Status:** Proposed, amended by [0010](0010-stack-python-django.md) · **Issue:** #5

## Context

M3 grades an automated pipeline and test coverage. M5 needs a live deployment.

## Decision

- **Vitest** in every workspace; the root `npm test` runs all of them. Native TypeScript and ESM, built-in
  coverage, the same assertion API as Jest.
- **Hosting: Vercel** for `apps/web`, with **managed PostgreSQL** (Neon, provisioned through Vercel) and
  **Vercel Blob** for files (ADR-0005). Migrations run with `prisma migrate deploy` during the build.

## Alternatives

- **Jest**: needs extra transforms for ESM and TypeScript.
- **Render / Railway / Fly.io**: a long-running server would allow local-disk storage, but the free tiers
  sleep or expire; Vercel is the reference host for Next.js.

## Consequences

- Requests are serverless: no in-memory state survives between requests. ACC-4 must store login attempts in
  the database, not in memory.
- Free-tier limits (function duration, database size) bound the size of uploads and extraction time.
