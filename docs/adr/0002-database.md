# 0002 Database: SQLite in dev, PostgreSQL in CI and prod, one schema file

**Status:** Proposed, amended by [0010](0010-stack-python-django.md) · **Issue:** #5 · **Traces to:** N10

## Context

M2 commits to SQLite for local development (no database server to install) and PostgreSQL in CI and
production, from **one** schema file (N10). Prisma's `datasource.provider` is a string literal; it cannot be
read from an environment variable.

## Decision

1. **`packages/db/prisma/schema.prisma` is the only schema file**, written with `provider = "postgresql"`.
2. **Every Prisma command goes through `packages/db/scripts/prisma.ts`.** The script reads `DATABASE_URL`:
   - `file:...` → it writes `prisma/.generated/schema.sqlite.prisma`, a copy with only the provider line
     changed (git-ignored), and runs Prisma against that copy.
   - `postgresql://...` → it runs Prisma against `schema.prisma` directly.
   - unset → `file:./dev.db` outside production, an error in production.
3. **Applying the schema**
   - PostgreSQL (CI, prod): `prisma migrate deploy` with the committed migrations in `prisma/migrations/`.
   - SQLite (dev): `prisma db push`. Migrations are PostgreSQL SQL and are not applied to SQLite.
4. **Creating a migration** needs PostgreSQL (a CI service container or a free managed dev database):
   `npm run db:migration:create -- <name>`. The schema owner (`CODEOWNERS`: Sejan) reviews every migration.
5. **Portable schema rule:** no native type attributes (`@db.Text`, `@db.Uuid`, ...), no PostgreSQL-only
   features (arrays, `Json` filters). Prisma enums are used; Prisma 6 supports them on both providers.
6. **Relative SQLite paths** are resolved against the repository root, so `file:./dev.db` means
   `<repo>/dev.db` for the CLI, the app and the tests alike.

### Keyword search on both (TUT-4)

Prisma's `mode: "insensitive"` is PostgreSQL-only. TUT-4 normalizes text instead: chunks store a lowercased
copy of their text, queries are lowercased in `packages/core`, and matching uses `contains`, which behaves the
same on both providers. PostgreSQL full-text ranking is out of scope for this release (ADR-0004).

## Alternatives

- **PostgreSQL everywhere via Docker**: one engine and true parity, but every member would have to install
  Docker, and at least one member's machine does not have it. Can be adopted later without changing the schema file.
- **Two schema files**: violates N10 and drifts.
- **SQLite in production**: no managed hosting option that fits ADR-0008.

## Consequences

- A query that works on SQLite can still fail on PostgreSQL (or the reverse). CI runs the whole suite on
  PostgreSQL, so CI is the source of truth.
- The generated Prisma client matches the provider of the `DATABASE_URL` present when `npm install` or
  `npm run db:generate` ran. After switching providers, run `npm run db:generate`.
- CI (FND-3) must set `DATABASE_URL` at job level, before `npm ci`.
