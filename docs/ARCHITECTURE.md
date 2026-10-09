# Hyntor Architecture

A guided tour of how the system fits together - written so you can find and fix anything.

## The big picture

```
                +---------------------+        +----------------------+
                |   apps/web          |        |   apps/mobile        |
                |   Next.js 15        |        |   Expo / React Native|
                |   (pages + UI)      |        |   (native screens)   |
                \--------+-------+------+        \------------+-----------+
                       |       |                          |
        in-process call|       | HTTP /api/trpc           | HTTP /api/trpc
        (server pages) |       | (browser)                | + Bearer JWT
                       v       v                          v
                +-----------------------------------------------------+
                |                  packages/api                       |
                |   tRPC routers: user, course, material, tutor, quiz,|
                |     workspace, discussion, study, flashcard,        |
                |     leaderboard                                     |
                |   + auth (passwords, JWT), file extraction,         |
                |     XP/streak engine, Anthropic client              |
                \--------------+----------------------+-----------------+
                             |                      |
                             v                      v
                +--------------------+   +-------------------------+
                |   packages/db      |   |   packages/core         |
                |   Prisma + SQLite/ |   |   types, zod schemas,   |
                |   PostgreSQL       |   |   TUTOR PROMPT SYSTEM   |
                \----------------------+   \---------------------------+
                                                    |
                                                    v
                                         Anthropic API (claude-sonnet-4-6)
```

**The rule that keeps this sane:** no business logic in the frontends. Web pages and mobile
screens only *call* the API package and render the result. If a behavior needs changing,
it's almost always in `packages/api` or `packages/core`.

## Request flows, end to end

### Web page load (e.g. /dashboard)
1. `apps/web/app/(app)/layout.tsx` runs on the server, calls `auth()` (NextAuth) -> session.
2. The page calls `serverApi()` (`apps/web/lib/server-api.ts`), which invokes tRPC routers
   **in-process** - no HTTP hop for server-rendered pages.
3. Routers read via the Prisma singleton (`packages/db/src/index.ts`).

### Web interaction (e.g. submitting a quiz)
1. A `"use client"` component calls `api.quiz.submit.mutate(...)` (`apps/web/lib/trpc.ts`).
2. That's an HTTP POST to `/api/trpc/quiz.submit` -> handled by
   `apps/web/app/api/trpc/[trpc]/route.ts`, which resolves the NextAuth session and builds
   the tRPC context.

### Mobile interaction
Same HTTP endpoint, but the context is authenticated by the `Authorization: Bearer <jwt>`
header instead of a cookie. The JWT is issued by `user.mobileLogin` and verified in
`packages/api/src/trpc.ts -> createContext`. Same secret (`AUTH_SECRET`), same user store.

### The tutor call (the most important flow)
`tutor.sendMessage` in `packages/api/src/routers/tutor.ts`:
1. Loads the session + message history (JSON column, zod-validated on read).
2. Computes `maxTierAllowed`: `CONCEPT` -> 0; `ASSIGNMENT_HELP` -> `1 + prior user messages`,
   capped at 4; `CODE_REVIEW`/`DEBUG` -> governed by their mode prompts.
3. Gathers **grounding**: the course's materials with extracted text, best-upvoted first,
   sliced to a ~60k-char budget (`MAX_GROUNDING_CHARS` in core).
4. Builds the system prompt (`buildTutorSystemPrompt` in `packages/core/src/prompts.ts`)  -
   persona + grounding rules + materials + mode block + tier budget.
5. Calls Claude. The reply starts with a `[TIER:n]` marker; `extractTierMarker` strips it.
6. Persists the updated history and `tierReached = max(old, n)`.

**Why server-side tier enforcement matters:** the model is told its ceiling each turn, but
even if it misbehaved, the ceiling only rises as the student actually engages - the client
can't request Tier 4 outright.

### File upload
Multipart doesn't flow through tRPC, so `apps/web/app/api/upload/route.ts` accepts the file
(25 MB cap), stores it in `apps/web/uploads/` (dev), and calls `createMaterialFromFile()`
in the API package - which checks enrollment, extracts text (`extract.ts`: pdf-parse /
mammoth / jszip), creates the Material row, and awards XP. Mobile can hit the same endpoint
with its Bearer token.

## Design decisions worth knowing (and why)

| Decision | Why |
|---|---|
| **SQLite in dev** instead of Postgres | Nothing to install; the whole app runs in 5 minutes. The schema is written to switch to Postgres by changing one line (see README). |
| **Enum-like fields are Strings** | SQLite has no Prisma enums. Allowed values live in ONE place - `packages/core/src/constants.ts` - and zod validates them at the API boundary. They can become native enums on Postgres later. |
| **JSON columns are `String`** with zod parsing | Portable across SQLite/Postgres; `parseJsonColumn()` validates on read so corrupt data can't crash pages. |
| **Mobile outside npm workspaces** | React Native + hoisted dependencies is a notorious failure mode on Windows. Standalone install = boring and reliable. The only cross-boundary import is the `AppRouter` **type** (erased at compile time). |
| **tRPC versions must match exactly** between root and mobile | Two different `@trpc/server` type copies make `AppRouter` collapse to `never`. Pinned with `--save-exact`. |
| **Pre-seeded quiz** | The full take-a-quiz loop demos without an API key. |
| **XP/streaks recorded from Phase 1** | The Phase 4 UI will have months of real data the day it ships. |
| **Quiz answers stripped server-side** | `quiz.get` removes correctOption/sampleAnswer/explanation so answers can't leak via browser devtools while taking a quiz. |

## Data model in one paragraph

`University` <- `User` <- `Enrollment` -> `Course` is the spine. Courses own `Material`
(with `extractedText` for grounding), `Quiz` (questions as JSON) with `QuizAttempt`
(answers + score + weakTopics), `TutorSession` (messages + tierReached), and the Phase 2+
tables already migrated: `Workspace`/`WorkspaceMember`/`Project`, `DiscussionThread`/
`DiscussionPost`, `ChatMessage`, `StudyPlan`, `Flashcard`, `MaterialUpvote`, `ActivityLog`.
Full schema with comments: `packages/db/prisma/schema.prisma`.

## Phase 2 - how collaboration works (shipped)

- **Workspaces** (`routers/workspace.ts`): study groups & project teams per course.
  Every workspace gets a `Project` row at creation, so the task board always exists  -
  tasks are a JSON column (`ProjectTask[]`, zod-validated). Membership is enforced by
  `requireWorkspaceMember` in `trpc.ts` (same pattern as `requireEnrollment`).
- **Group chat**: simple POLLING on `ChatMessage` - the client refetches
  `workspace.chatList` every `CHAT_POLL_INTERVAL_MS` (3s, in core constants). No
  websockets, no paid realtime service; plenty for study-group-sized rooms. Upgrade
  path: swap the poll for a subscription transport later, the API shape stays.
- **Discussion boards** (`routers/discussion.ts`): threads per course with a
  `contextType` (COURSE | QUIZ | MATERIAL | EXAM). The class can INVOKE the AI tutor
  into a thread: `discussion.askTutor` feeds it the labeled transcript + course
  grounding and it posts ONE reply (`authorId = null`). The reply keeps its `[TIER:n]`
  marker in the stored body (stripped on read) so the tier badge survives reloads.
  **Public-board tier policy**: the ceiling rises with student posts but caps at
  Tier 3 (`DISCUSSION_MAX_TIER`) - a Tier 4 walkthrough of graded work, visible to the
  whole class, would be answer-dumping by proxy. See `buildDiscussionTutorPrompt`.
- **Cross-university courses**: a course "belongs to" the universities of its enrolled
  members (the creator auto-enrolls, so a new course is instantly visible to their
  peers). `course.browse` shows your university's courses plus anything flagged
  `isCrossUniversity` - those are open to everyone (global badge in the UI).

## Phase 4 - engagement (in progress)

- **Material upvoting** (`material.upvote`): the class's quality signal. Toggling writes
  the `MaterialUpvote` join table and recomputes `Material.upvoteCount` from it inside one
  transaction, so the denormalized count never drifts from the join table (the source of
  truth). Self-upvotes are blocked; the first upvote awards the UPLOADER XP
  (`MATERIAL_UPVOTED`) without touching their streak. This count is what `gatherGrounding`
  and the shared library already sort by, so better materials rise for everyone.
- **Leaderboard** (`leaderboard.get`): ranks `User.xp` (streak as tiebreaker) over the
  student's whole school or one enrolled course, always including the caller's own rank,
  with a per-user XP-by-activity breakdown read from `ActivityLog`. No new tables - it
  reads the XP/streak/activity data recorded since Phase 1.
- **Inline annotations** (`annotation.*`): shared, class-visible notes on a material. The
  `Annotation` table (added in migration `20260616160500_add_annotations`) stores an
  optional `quote` (the highlighted snippet a note anchors to) plus the body. The web
  panel captures the page text selection (`window.getSelection()`) to fill the quote.
  Anyone enrolled reads/adds; you can only delete your own.
- **Code sandbox** (`/sandbox`, web-only): a JavaScript scratchpad. Code runs in a Web
  Worker created from a Blob URL - no DOM/app access - with `console.*` captured and a
  2s watchdog that `terminate()`s runaway loops so the tab never freezes. No server, no
  API, no schema; works identically with or without an API key.

## Where remaining features hook in

Search the repo for `TODO Phase`. Still open:
- **Concept visualizer (P4)**: not yet built (would need AI, with a keyless fallback like
  the study planner).
- The spine (`MaterialUpvote`, `Annotation`, `ActivityLog`, XP/streak on `User`) is live,
  so remaining features are additive.
