# 0001 Stack

**Status:** Superseded by [0010](0010-stack-python-django.md) · **Issue:** #5

## Context

Four members, one semester, one web client. M4 grades architectural cohesion, so the stack has to keep the
client, API and database in one language with types shared across the boundary (N8).

## Decision

- **Next.js 15 (App Router) + React 19 + TypeScript 5.9 + Tailwind CSS 4** in `apps/web`.
- **tRPC v11** for the API, in `packages/api`, served by a Next.js route handler at `/api/trpc`. Clients use
  `@trpc/tanstack-react-query`.
- **Zod 4** for every input schema, kept in `packages/core` so client and server validate with the same code.
- **Prisma 6** in `packages/db` (see ADR-0002).
- **npm workspaces**: `apps/web`, `packages/api`, `packages/core`, `packages/db`. Packages are consumed as
  TypeScript source (`transpilePackages`), so there is no per-package build step.
- **Node 24** (`.nvmrc`, `engines`), the same version in CI.

Versions are pinned in `package.json` and were checked on npm on 2026-10-19.

## Alternatives

- **Next.js 16**: newer, but the backlog and M2 were written against 15. Upgrading is a separate issue.
- **REST route handlers or server actions only**: no end-to-end types for procedures that the tutor and
  library pages share; per-route auth checks get duplicated instead of living in procedure builders.
- **Prisma 7**: requires driver adapters and `prisma.config.ts`, and would need a second adapter swap on top
  of the provider swap in ADR-0002. Prisma 6.19 is the last 6.x line and supports both providers natively.
- **TypeScript 7 (native port)**: Next.js 15 type-checks through the TypeScript 5 compiler API.
- **pnpm / Turborepo**: faster, but one more tool for every member to learn; npm workspaces are enough for
  four packages.

## Consequences

- One `tsconfig.base.json` with `"strict": true`; every package extends it.
- Domain rules live in `packages/core`; routers in `packages/api` stay thin.
- Upgrading Next.js or Prisma to the next major is its own issue with its own ADR.
