# hyntor-ai

Hyntor is a course library and AI tutor: students share materials for a course across terms, and the tutor
answers from those materials with hints before full answers.

Architecture decisions are in [docs/adr](docs/adr/README.md).

## Run locally

### Prerequisites

- **Node.js 24** (the version in `.nvmrc`; with nvm: `nvm use`) and npm 11
- Git
- Nothing else: development uses a SQLite file, so no database server is needed (ADR-0002)

### Steps

```sh
# 1. Clone
git clone https://github.com/Hyntor/hyntor-ai.git
cd hyntor-ai

# 2. Environment: the defaults work as-is for local development
cp .env.example .env

# 3. Install (also generates the Prisma client for the provider in DATABASE_URL)
npm install

# 4. Create the database schema
npm run db:migrate

# 5. Load the demo data (safe to run again: it creates nothing the second time)
npm run db:seed

# 6. Start the app at http://localhost:3000
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` in step 2.

### Demo accounts

All seeded accounts use the password `hyntor-demo-password` (or `SEED_PASSWORD` from `.env`).

| Email                    | Role                                                  |
| ------------------------ | ----------------------------------------------------- |
| `learner1@example.edu`   | Learner, enrolled in CSCI 1010 in 2026-SP             |
| `learner2@example.edu`   | Learner, enrolled in CSCI 1010 in 2026-FA             |
| `maintainer@example.edu` | Course maintainer of CSCI 1010 in 2026-SP and 2026-FA |
| `admin@example.edu`      | Platform administrator                                |

The demo course has three materials (PDF, DOCX, PPTX) from `packages/db/seed/files/`. They are notes the team
wrote for the demo, not course files.

### Starting over

```sh
npm run db:reset   # drops all data and stored files, re-applies the schema, seeds
```

## Scripts

| Script                             | What it does                                                               |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                      | Next.js dev server                                                         |
| `npm run build`                    | Production build of `apps/web`                                             |
| `npm run typecheck`                | `tsc --noEmit` in every workspace                                          |
| `npm run lint`                     | ESLint, zero warnings allowed                                              |
| `npm run format` / `format:check`  | Prettier write / check                                                     |
| `npm test`                         | Vitest in every workspace (database tests use `./test.db`, never `dev.db`) |
| `npm run db:generate`              | Regenerate the Prisma client (after switching provider)                    |
| `npm run db:migrate`               | Apply the schema: `db push` on SQLite, `migrate deploy` on PostgreSQL      |
| `npm run db:migration:create -- x` | New migration named `x` (needs a PostgreSQL `DATABASE_URL`)                |
| `npm run db:seed`                  | Load the demo data (idempotent)                                            |
| `npm run db:reset`                 | Drop, migrate, seed                                                        |

## Repository layout

```
apps/web        Next.js App Router UI and the /api/trpc route handler
packages/api    tRPC routers
packages/core   Shared types, Zod schemas, constants
packages/db     Prisma schema, migrations, client, seed
docs/adr        Architecture decision records
```
