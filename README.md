# Hyntor

> **Don't just get the answer. Actually learn it.**

Hyntor is a responsible-AI study platform. The AI is a **Socratic tutor, not an answer
vending machine**: it explains concepts generously, grounds every answer in *your* course's
uploaded materials, and on graded work it guides you with escalating hints instead of handing
over solutions. Web app + native mobile app, one shared API.

| | |
|---|---|
| **Web** | Next.js 15 (App Router) + TypeScript + Tailwind - `apps/web` |
| **Mobile** | Expo SDK 56 + Expo Router + TypeScript - `apps/mobile` |
| **API** | tRPC v11, shared by both apps - `packages/api` |
| **Database** | Prisma + SQLite (dev) / PostgreSQL (prod) - `packages/db` |
| **Shared logic** | Types, validation, AI tutor prompts - `packages/core` |
| **AI** | Anthropic API, model `claude-sonnet-4-6` |

---

## Quick start (5 minutes)

You need **Node.js 18.18+** (you have it if `node --version` works).

```bash
# 1. Install dependencies
npm install

# 2. Create env files (generates a random AUTH_SECRET for you)
npm run setup

# 3. Create + seed the database
npm run db:setup

# 4. Run the web app
npm run dev
```

Open **http://localhost:3000** and log in with the demo account:

| Email | Password | Role |
|---|---|---|
| `alex@demo.edu` | `coursemind` | Student |
| `maya@demo.edu` | `coursemind` | Student |
| `sam@demo.edu` | `coursemind` | TA |

The seed includes a demo university, the CS201 course, two lecture-note materials, and a
ready-made practice quiz - so **the full loop works before you configure anything else**.

## Enabling AI features

The tutor chat, quiz generation, and AI grading need an Anthropic API key:

1. Get a key at https://console.anthropic.com/settings/keys
2. Open `apps/web/.env.local` and set: `ANTHROPIC_API_KEY="sk-ant-..."`
3. Restart the dev server (`Ctrl+C`, then `npm run dev` again)

Without a key the app still runs - AI features show a friendly setup message instead of crashing.

## Running the mobile app

The mobile app is installed separately (it's intentionally **not** part of the npm workspaces  -
React Native dependencies break when hoisted):

```bash
cd apps/mobile
npm install
npx expo start
```

Then press `a` for an Android emulator, `i` for an iOS simulator (Mac only), or scan the QR
code with the **Expo Go** app on your phone.

**Important - point the app at your API.** The mobile app needs to reach the web server:

| Where the app runs | API URL to use |
|---|---|
| iOS simulator / web preview | `http://localhost:3000` (the default) |
| Android emulator | `http://10.0.2.2:3000` |
| Physical phone (same Wi-Fi) | `http://YOUR-PC-IP:3000` (find it with `ipconfig`) |

Set it via environment variable when starting:
```bash
# PowerShell example for a physical phone:
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.42:3000"; npx expo start
```

App Store / Play Store shipping steps are in [MOBILE_RELEASE.md](MOBILE_RELEASE.md).

## All commands (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app (http://localhost:3000) |
| `npm run setup` | Create env files (safe to re-run; never overwrites) |
| `npm run db:setup` | Generate Prisma client + migrate + seed, all in one |
| `npm run db:migrate` | Create/apply a migration after you change `schema.prisma` |
| `npm run db:seed` | Re-run the seed (safe: it never duplicates) |
| `npm run db:studio` | Open Prisma Studio - browse/edit the database in a GUI |
| `npm run typecheck` | TypeScript check across every workspace |
| `npm run build` | Production build of the web app |

## Project layout

```
Hyntor/
|---- apps/
|   |---- web/          <- Next.js app (pages, auth, upload endpoint)
|   \---- mobile/       <- Expo app (native screens; own node_modules)
|---- packages/
|   |---- api/          <- ALL business logic: tRPC routers, AI calls, auth,
|   |                    file text-extraction. Web + mobile both use this.
|   |---- core/         <- Shared types, zod schemas, the tutor prompt system
|   |                    (the tier logic lives in core/src/prompts.ts)
|   \---- db/           <- Prisma schema, migrations, seed, client singleton
|---- docs/
|   |---- ARCHITECTURE.md         <- how everything fits together
|   |---- TROUBLESHOOTING.md      <- START HERE when something breaks
|   |---- BUSINESS_PLAN.md        <- market, model, go-to-market
|   \---- COMPETITOR_RESEARCH.md  <- deep dive on the competitive landscape
|---- .env.example      <- documented template for every env var
\---- MOBILE_RELEASE.md <- App Store / Play Store shipping guide
```

## How the AI tutor works (the heart)

Defined in `packages/core/src/prompts.ts`, enforced in `packages/api/src/routers/tutor.ts`:

- **Concept questions** (Tier 0): answered fully and generously.
- **Assignment help**: the server computes the maximum hint tier allowed  -
  it starts at **Tier 1 (nudge)** and rises one tier per exchange as the student engages,
  capping at **Tier 4 (structured walkthrough)**. The model never hands over a submittable
  answer; the ceiling is enforced server-side, not by trusting the model.
- **Code review**: points at bugs with questions ("what happens when the list is empty?");
  never writes corrected code.
- Every reply is grounded in the course's uploaded materials and **flags clearly** when it
  goes beyond them.
- The tier used is shown as a badge in the UI and recorded on `TutorSession.tierReached`.

## Deploying to the web (Vercel + Neon)

The full step-by-step guide is in **[docs/DEPLOY.md](docs/DEPLOY.md)** — create a free Neon
Postgres database, import the repo into Vercel, set three environment variables, and deploy.

You don't edit the schema by hand: local dev stays on SQLite, and the production build
generates the PostgreSQL schema automatically from `schema.prisma` (single source of truth).
Every push to `main` redeploys.

## Phase status

- [done] **Phase 1 - Core learning loop** (live): signup with university email, courses,
  shared material library with PDF/DOCX/PPTX text extraction, grounded tiered tutor,
  quiz generation/taking/grading, pre-submit code review, XP + streaks (data layer)
- [done] **Phase 2 - Collaboration** (live): study-group/project workspaces with task boards,
  group chat (simple polling - no extra infra), exam discussion boards where the AI tutor
  can be invoked (hint tiers only, capped at Tier 3 in public), cross-university courses,
  debug-with-me mode in the tutor hub
- [done] **Phase 3 - Smart studying** (live): syllabus import/autopilot, mock exams,
  spaced repetition (SM-2 flashcards), weak-spot radar, AI study plans with a no-key
  deterministic fallback, plus a native-mobile Smart Study screen
- [done] **Phase 4 - Engagement** (live): material upvoting (the class's quality signal,
  rewards uploaders with XP), XP/streak leaderboards (school- or course-scoped), shared
  inline annotations on materials (highlight text to anchor a class-visible note), a
  safe in-browser JavaScript code sandbox, and the concept visualizer (AI concept maps
  grounded in class materials, with a no-key offline study-map fallback)

All four planned phases are complete on web. Still open beyond the original plan:
native-mobile parity for Phases 2/4 (the Expo app covers Phase 1 + Smart Study),
real billing for the Pro plan, and live AI/email keys (see `docs/DEPLOY.md`).
