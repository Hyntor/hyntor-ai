# AI Handoff

This file is the shared working log for Codex, Claude Code, and the user. Read it before starting work and update it after meaningful changes.

## Project Summary

Project name: Hyntor, formerly CourseMind.

Hyntor is a student-first class study platform. Students join courses and share class materials that matter for studying: lecture notes, slides, homework prompts, tests, practice exams, discussion context, and other course files. The AI uses that class-specific context to help students understand the class and prepare effectively.

The product should not be framed only as "grounded tutoring from uploaded notes." The stronger framing is: shared course context plus AI help, with the class library making the app smarter and more useful for everyone in the course.

The core promise remains learning-first AI:
- Explain concepts generously.
- Use the course's shared context whenever available.
- For graded or likely-graded work, guide with hints rather than final submittable answers.
- Keep the hint-tier system visible as a product differentiator.

## Current Architecture

- `apps/web`: Next.js App Router web app.
- `apps/mobile`: Expo mobile app.
- `packages/api`: tRPC API and business logic.
- `packages/core`: shared types, constants, prompts, AI behavior.
- `packages/db`: Prisma schema, migrations, seed data.

## Coordination Protocol

Before work:
- Run `git status --short`.
- Read this file.
- Check whether another agent has uncommitted changes in the files you plan to touch.

During work:
- Keep edits scoped.
- Do not revert user or other-agent work.
- If the same file is being edited by another agent, either coordinate or make a smaller change elsewhere.

After work:
- Add a dated entry below with summary, files touched, checks run, and next steps.

## Work Log

### 2026-06-12 - Codex - Shared Context Setup

Summary:
- Added shared project context for Codex and Claude Code.
- Captured the corrected product framing: students share class materials, homework prompts, tests/practice exams, and course context so the AI can help with that class.
- Preserved the learning-first and hint-tier positioning already present in the product.

Files touched:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/AI_HANDOFF.md`

Checks run:
- `git status --short`
- Confirmed `AGENTS.md`, `CLAUDE.md`, and `docs/AI_HANDOFF.md` did not exist before setup.

Notes:
- Existing uncommitted changes were already present before this setup:
  - `packages/core/src/prompts.ts`
  - `packages/core/src/sm2.ts`
  - `packages/core/src/studyplan.ts`
  - `.claude/`
- These were not modified by Codex during this setup.

Next steps:
- In Claude Code, ask Claude to read `CLAUDE.md` and `docs/AI_HANDOFF.md`.
- In future Codex sessions, Codex should automatically load `AGENTS.md`; for this live session, explicitly ask Codex to read `AGENTS.md` and this handoff if needed.
- Decide whether to run a full CourseMind-to-Hyntor rename pass across app UI, docs, packages, and metadata.

### 2026-06-12 - Codex - Phase 3 Smart Study Web/API

Summary:
- Continued from Claude's Phase 3 core helper work and completed a working web/API vertical slice.
- Added course Smart Study hub with exam study plans, weak-topic radar, flashcard generation/review, and mock exam generation.
- Added no-key fallback behavior for study plans and flashcards; mock exams still require `ANTHROPIC_API_KEY`.
- Fixed the authenticated app shell so course tools are usable on mobile web instead of being clipped by the desktop sidebar.
- Added `docs/PHASE3_SMART_STUDY.md` as the implementation note.

Files touched:
- `apps/web/app/(app)/courses/[courseId]/study/page.tsx`
- `apps/web/app/(app)/courses/[courseId]/page.tsx`
- `apps/web/app/(app)/layout.tsx`
- `packages/api/src/root.ts`
- `packages/api/src/routers/study.ts`
- `packages/api/src/routers/flashcard.ts`
- `packages/api/src/routers/quiz.ts`
- `packages/core/src/index.ts`
- `packages/core/src/types.ts`
- `packages/core/src/prompts.ts`
- `packages/core/src/sm2.ts`
- `packages/core/src/studyplan.ts`
- `docs/PHASE3_SMART_STUDY.md`
- `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck --workspace packages/api`
- `npm run typecheck --workspace packages/core`
- `npm run typecheck --workspace apps/web`
- `npm run typecheck`
- `npm run build`
- In-app browser QA on login, CS201 course page, and `/courses/cmq8qy9t00007oetsgyv8u3nh/study`.

Browser QA notes:
- Demo login with `alex@demo.edu / coursemind` succeeded.
- Course page showed the new Smart Study link.
- Study plan creation for `2026-06-20` succeeded and rendered a schedule.
- Marking the first plan day complete persisted.
- Flashcard generation created review cards without an API key.
- Revealing and rating a flashcard updated the queue from 9 due to 8 due.
- Mock exam generation showed the friendly no-key setup message because no `ANTHROPIC_API_KEY` is configured.
- Desktop and mobile viewport checks showed no console errors after the responsive shell fix.

Notes:
- The local dev database now contains QA/demo data from Phase 2 and Phase 3 verification, including a CS201 study plan and flashcards for Alex. Run `npm run db:setup` to reset demo data.
- The mobile native app does not yet have Phase 3 screens.
- Existing docs and UI still mostly use the CourseMind name. Hyntor remains the preferred new brand, but no full rename pass has been run.

Next steps:
- Add native mobile screens for the Smart Study hub.
- Add syllabus-import UX beyond using uploaded `SYLLABUS` materials.
- Add a real weak-spot chart visualization if the product wants richer analytics.
- Run the full CourseMind-to-Hyntor rename pass when the user confirms.

### 2026-06-12 - Codex - Web Visual Redesign

Summary:
- Reworked the web visual system around a more modern student-facing palette, glass surfaces, sharper 8px cards, stronger typography, and consistent command/button treatment.
- Updated the authenticated shell, dashboard, tutor hub, tutor chat, courses, course detail, smart study, upload, materials, discussions, workspaces, quizzes, auth screens, and public landing page.
- Removed old emoji/encoding artifacts from the touched UI and replaced mode/context markers with short structured badges.
- Kept behavior and data contracts unchanged.

Files touched:
- `apps/web/tailwind.config.ts`
- `apps/web/app/globals.css`
- `apps/web/components/ui.tsx`
- `apps/web/components/GenerateQuizButton.tsx`
- Most `apps/web/app` web pages and two API route comments touched for encoding cleanup.
- `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck --workspace apps/web`
- `npm run typecheck`
- `git diff --check`
- In-app browser QA at desktop and mobile viewports on `/tutor`, `/dashboard`, `/courses`, `/code-review`, and a course Smart Study route.

Browser QA notes:
- Demo login with `alex@demo.edu / coursemind` succeeded.
- `/tutor` rendered the new session cards and past-session surface with no horizontal overflow.
- Mobile app shell now uses a two-column nav grid instead of a horizontal scrollbar.
- Dashboard, Courses, Code Review, and Smart Study rendered with no console errors, no old mojibake artifacts, and no horizontal overflow.

Next steps:
- Run the production build after this entry.
- Continue using Hyntor in UI until the user explicitly confirms a full rename pass.

### 2026-06-12 - Codex - Hyntor Rename and iOS-Inspired Redesign

Summary:
- Renamed the product-facing brand to Hyntor across web UI, mobile metadata, docs, seed logs, and AI prompt persona.
- Reworked the web visual system toward an iOS-inspired interface: system/SF-style font stack, white/translucent surfaces, Apple-like blue accent, quieter shadows, flatter rounded controls, and a light app shell.
- Updated the landing, auth screens, authenticated shell, dashboard, tutor hub, and shared UI primitives for consistent Hyntor branding.
- Cleaned encoding fallout from the earlier broad rename pass and normalized touched docs/prompts to ASCII.
- Kept internal workspace package scopes as `@coursemind/*` to avoid a risky package namespace migration in the same change.

Files touched:
- `apps/web/tailwind.config.ts`
- `apps/web/app/globals.css`
- `apps/web/components/ui.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/(app)/layout.tsx`
- Main web app pages under `apps/web/app/(app)`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/mobile/app.json`
- `packages/core/src/prompts.ts`
- `packages/api/src/auth.ts`
- `packages/api/src/routers/discussion.ts`
- `packages/db/prisma/seed.ts`
- Project docs and metadata

Checks run:
- `npm run typecheck`
- `git diff --check`
- `npm run build`
- In-app browser QA on `/tutor`, `/dashboard`, and `/login` at desktop and iPhone-width viewports.

Browser QA notes:
- `/tutor` loaded as Alex with no console errors.
- Desktop viewport `1440x900` and mobile viewport `390x844` had no horizontal overflow.
- Dashboard and login pages rendered with Hyntor branding, system font stack, light surfaces, and no console errors.

Next steps:
- If the package namespace ever needs to match the product name, migrate `@coursemind/*` imports in a dedicated change.

### 2026-06-12 - Codex - Dashboard Smart Study Overview

Summary:
- Added a dashboard-level Smart Study overview API that summarizes each enrolled course's due flashcards, weak topics, active study plan progress, and next plan day.
- Updated the dashboard to show a Smart Study priority section immediately after the daily hero.
- Added course-level priority cards with review queue counts, material/quiz counts, next study-plan date, progress bar, weak-topic chips, and direct links into each course's Smart Study hub.

Files touched:
- `packages/api/src/routers/study.ts`
- `apps/web/app/(app)/dashboard/page.tsx`
- `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck`
- `git diff --check`
- `npm run build`
- In-app browser QA on `/dashboard` at default, `1440x900`, and `390x844` viewports.

Browser QA notes:
- Dashboard rendered the new Smart Study section for Alex.
- Desktop and iPhone-width checks had no horizontal overflow.
- No console errors were reported.

Next steps:
- Add a dedicated weak-topic visualization inside the course Smart Study page if richer analytics are needed.
- Bring Smart Study surfaces into the native mobile app.

### 2026-06-12 - Codex - Course Smart Study Analytics

Summary:
- Upgraded the course Smart Study page with a readiness panel showing study-plan progress, next study block, review queue pressure, and weak-topic misses.
- Reworked the weak spots panel into a weak-topic radar with ranked severity bars, a focused tutor link, and a recommended next move.
- Added accessible progressbar labels and values for the new visual progress indicators.

Files touched:
- `apps/web/app/(app)/courses/[courseId]/study/page.tsx`
- `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck`
- `git diff --check`
- `npm run build`
- In-app browser QA on the CS201 Smart Study route at default and `390x844` viewports.

Browser QA notes:
- Smart Study page rendered the new Course pulse and Weak topic radar panels after client data load.
- Desktop/default and iPhone-width checks had no horizontal overflow.
- No console errors were reported.

Next steps:
- Bring Smart Study surfaces into the native mobile app.
- Consider adding click-through weak-topic filters for quiz generation later.

### 2026-06-12 - Codex - Native Mobile Smart Study

Summary:
- Added a native Expo Smart Study screen at `/study/[courseId]` backed by the existing `study.courseDashboard` API.
- Added a Smart Study entry card on the native course detail screen.
- Updated native mobile theme tokens to match the Hyntor/iOS-inspired web palette.
- Cleaned corrupted mobile UI glyphs in course list, course detail, tutor hub, profile, quiz, and tutor chat screens.
- Replaced mobile tab emoji icons with compact text marks for reliable rendering.

Files touched:
- `apps/mobile/src/app/study/[courseId].tsx`
- `apps/mobile/src/app/course/[id].tsx`
- `apps/mobile/src/app/(tabs)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/courses.tsx`
- `apps/mobile/src/app/(tabs)/tutor.tsx`
- `apps/mobile/src/app/(tabs)/profile.tsx`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/app/login.tsx`
- `apps/mobile/src/app/session/[id].tsx`
- `apps/mobile/src/app/quiz/[id].tsx`
- `apps/mobile/src/lib/theme.ts`
- `docs/PHASE3_SMART_STUDY.md`
- `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck`
- `npx tsc --noEmit` from `apps/mobile`
- `npm run build`
- `git diff --check`
- `npx expo config --type public`
- Mobile source scan for non-ASCII/corrupted glyphs in `apps/mobile/src`, `apps/mobile/app.json`, and `apps/mobile/README.md`.

Notes:
- This native Smart Study screen is read-only for now: course pulse, weak-topic radar, latest schedule, and flashcard stats.
- Web remains the place to create plans, generate flashcards, and run mock exams.

Next steps:
- Add native mobile actions for study-plan creation and flashcard review.
- Consider click-through weak-topic filters for quiz generation later.

### 2026-06-12 - Codex - Syllabus Autopilot

Summary:
- Added `study.importSyllabus` to save pasted syllabi as `SYLLABUS` materials, extract dated milestones, and generate deadline-aware study plans.
- Added deterministic syllabus parsing and workback schedule helpers in `packages/core/src/syllabus.ts`.
- Added an AI prompt for structured syllabus milestone extraction; Anthropic is used when configured, with deterministic fallback otherwise.
- Updated the course Smart Study page with a Syllabus Autopilot panel, post-scan summary, deadline rows in the study plan, and an upcoming syllabus timeline.
- Connected the existing pasted-text upload flow so choosing type `SYLLABUS` builds the Smart Study plan and redirects to the course Smart Study page.

Files touched:
- `packages/core/src/constants.ts`
- `packages/core/src/types.ts`
- `packages/core/src/prompts.ts`
- `packages/core/src/studyplan.ts`
- `packages/core/src/syllabus.ts`
- `packages/core/src/index.ts`
- `packages/api/src/routers/study.ts`
- `apps/web/app/(app)/courses/[courseId]/study/page.tsx`
- `apps/web/app/(app)/courses/[courseId]/upload/page.tsx`
- `docs/PHASE3_SMART_STUDY.md`
- `docs/AI_HANDOFF.md`

Checks run so far:
- `npm run typecheck`
- `npx tsc --noEmit` from `apps/mobile`
- `git diff --check`
- `npm run build`
- In-process `study.importSyllabus` QA with `ANTHROPIC_API_KEY` blank: 6 milestones, 19 schedule rows, plan created.
- In-app browser QA on `/courses/cmq8qy9t00007oetsgyv8u3nh/study` at `1440x900` and `390x844`: Syllabus Autopilot visible, timeline visible, no horizontal overflow, no console errors.

Notes:
- No database migration was needed. Syllabus deadlines are encoded in `StudyPlan.schedule` with optional `kind`, `source`, and `milestoneType` fields.
- Existing schedules remain compatible because `StudyPlanDaySchema` defaults missing `kind` to `study`.

Next steps:
- Add native mobile syllabus import and timeline display.
- Consider calendar export or notification reminders for syllabus deadlines.

### 2026-06-12 - Codex - School Email Recognition

Summary:
- Added reusable school-domain helpers in `packages/api/src/auth.ts` for parsing school email domains, rejecting personal mail domains, and deriving school names.
- Added public `user.schoolPreview` so signup can preview whether a school is recognized, how many related courses/resources exist, or whether a new school space will be created.
- Added protected `user.schoolHub` with the current user's university, school graph stats, related courses, and top shared resources.
- Updated `course.browse` to mark school-matched courses so the UI can separate campus courses from global/open courses.
- Updated signup to show automatic school recognition beneath the email field.
- Updated dashboard with a School Graph section that surfaces school courses and top resources immediately after login.
- Updated `/courses` to prioritize school-matched courses and show open cross-university courses separately.

Files touched:
- `packages/api/src/auth.ts`
- `packages/api/src/routers/user.ts`
- `packages/api/src/routers/course.ts`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/app/(app)/courses/page.tsx`
- `docs/AI_HANDOFF.md`

Checks run so far:
- `npm run typecheck`
- `npx tsc --noEmit` from `apps/mobile`
- `git diff --check`
- `npm run build`
- In-process API QA for `user.schoolPreview`, `user.schoolHub`, and `course.browse.schoolMatched`.
- In-app browser QA on `/dashboard`, `/courses`, and `/signup` at `1440x900`, plus `/courses` at `390x844`: school graph/grouping visible, no horizontal overflow, no console errors.

Notes:
- No schema migration was needed. The existing `University`, `User.universityId`, and enrollment graph already support school matching.
- Signup still creates a new `University` row for unknown school domains.

Next steps:
- Add the same school preview during native mobile signup if mobile signup is added.
- Consider allowing verified school admins to rename the auto-created school display name.

### 2026-06-14 - Claude Code - Phase 4 Engagement: Upvoting + Leaderboard

Summary:
- Started Phase 4 (Engagement) with the two most data-ready, lowest-collision pieces.
- Material upvoting: `material.upvote` toggles the current user's upvote, keeps the
  denormalized `Material.upvoteCount` in sync with the `MaterialUpvote` join table inside
  a transaction (the join table is the source of truth), blocks self-upvotes, and rewards
  the UPLOADER with XP (`MATERIAL_UPVOTED`, 5) on the first upvote only - XP without
  streak, since the uploader didn't act that day. `material.get` now returns `upvotedByMe`
  and `isMine`. New web `UpvoteButton` wired into the material detail page header.
- Leaderboard: new `leaderboardRouter.get` ranks by XP then streak, scoped to the
  student's whole school (default) or a single enrolled course, always returns the
  current user's own rank even when below the visible top 20, and includes a per-user
  XP-by-activity breakdown read from `ActivityLog`. New `/leaderboard` web page (scope
  picker, "you" highlight, rank medals, role badges, XP breakdown) + sidebar nav entry.
- Updated `XP_RULES` (added `MATERIAL_UPVOTED`) and added `XP_RULE_LABELS` in core.
- Fixed seed data consistency: the seed hardcoded `upvoteCount` (4/2) with no backing
  `MaterialUpvote` rows, so the source-of-truth recompute would "correct" counts downward
  on first real upvote. Seed now creates real upvote rows (a student never upvotes their
  own upload) and recomputes `upvoteCount` from them.

Files touched:
- `packages/core/src/constants.ts`
- `packages/api/src/routers/material.ts`
- `packages/api/src/routers/leaderboard.ts` (new)
- `packages/api/src/root.ts`
- `packages/db/prisma/seed.ts`
- `apps/web/components/UpvoteButton.tsx` (new)
- `apps/web/app/(app)/materials/[materialId]/page.tsx`
- `apps/web/app/(app)/leaderboard/page.tsx` (new)
- `apps/web/app/(app)/layout.tsx`
- `README.md`, `docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck` (all four workspaces clean)
- `npm run build` (clean; `/leaderboard` and `/materials/[materialId]` routes compiled).
  Note: `next build` throws `EPERM .next/trace` if a dev server is holding `.next` - stop
  the preview/dev server before building.
- Browser QA as `alex@demo.edu`:
  - Leaderboard: school scope ranks Maya/Alex/Sam by XP, "you" highlight + TA badge
    correct; course scope ("CS201 members") filters; XP breakdown renders.
  - Upvote toggle on Maya's notes: 2 -> 1 (off) -> 2 (on); uploader Maya XP 345 -> 350
    (+5 on the on-transition only, un-upvote does not subtract); ActivityLog row written.
  - Self-upvote guard: button disabled with "your upload" tooltip on Alex's own material.
  - No console or server errors.

Notes:
- Dev DB cleanup during QA: the course had DUPLICATE seed materials because the seed
  titles were changed from em-dash to hyphen during the rename, so older em-dash rows
  lingered. I repointed the practice quiz to the canonical (hyphen) hash-notes material
  and deleted the two legacy em-dash materials. The course now has exactly two materials,
  both with `upvoteCount` consistent with their join rows. `npm run db:setup` gives a
  clean slate either way.
- No schema migration was needed - `MaterialUpvote`, `ActivityLog`, `User.xp/streakCount`
  and `Material.upvoteCount` were all already in place.

Next steps:
- Surface upvote buttons in the course material list (currently read-only counts there)
  and bring upvoting + leaderboard into the native mobile app.
- Remaining Phase 4: inline material annotations, code sandbox, concept visualizer.
- Optional: award the upvoter (not just uploader) a tiny XP, or add anti-farm guards if
  upvote-driven XP is ever weighted more heavily.

### 2026-06-14 - Claude Code - Phase 4: Inline Material Annotations

Summary:
- Added shared, class-visible annotations on materials. The `Annotation` table stores an
  optional `quote` (a highlighted snippet of the material the note is anchored to) plus
  the note body; flat (no threading). Anyone enrolled in the material's course reads/adds;
  you can only delete your own notes (`annotation.delete` enforces FORBIDDEN otherwise).
- New `annotationRouter` (listByMaterial / create / delete), registered in root.ts.
- New web `AnnotationsPanel` on the material detail page: lists class notes, captures the
  page text selection (`window.getSelection()`) via a "Quote selection" button to anchor a
  note, posts, and deletes own notes. `onMouseDown preventDefault` on that button keeps
  the selection from collapsing when it takes focus.

Files touched:
- `packages/db/prisma/schema.prisma` (Annotation model + back-relations on Material/User;
  refreshed two stale Phase 4 TODO comments)
- `packages/db/prisma/migrations/20260616160500_add_annotations/migration.sql` (new)
- `packages/api/src/routers/annotation.ts` (new)
- `packages/api/src/root.ts`
- `apps/web/components/AnnotationsPanel.tsx` (new)
- `apps/web/app/(app)/materials/[materialId]/page.tsx`
- `README.md`, `docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck` (all workspaces clean), `npm run build` (clean).
- Browser QA as `alex@demo.edu` on the Hash Tables material:
  - Selected text in the material -> "Quote selection" captured it into the composer ->
    posted a note -> rendered with the quoted snippet, "you" tag, and Delete; composer
    cleared.
  - Inserted a note as Maya via DB, reloaded: Alex sees it (class-visible) with NO Delete
    button and no "you" tag (ownership correct).
  - Deleted Alex's own note -> removed; Maya's note stayed.
  - No console or server errors.

Notes:
- MIGRATION GOTCHA (important for this environment): `npm run db:migrate`
  (`prisma migrate dev`) HANGS - it needs an interactive TTY that the agent's background
  shell doesn't provide, and it left no output and no migration folder. I killed it and
  created the migration deterministically instead:
  `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script`
  into a timestamped `migrations/<ts>_add_annotations/migration.sql`, then
  `prisma migrate deploy` (non-interactive) + `prisma generate`. The applied SQL is the
  standard additive `CREATE TABLE Annotation` + index - identical to what migrate dev
  would have written. Use this diff+deploy path for future migrations here.
- The dev DB now has a demo annotation from Maya on the Hash Tables material.

Next steps:
- Remaining Phase 4: code sandbox, concept visualizer.
- Bring upvoting, leaderboard, and annotations into the native mobile app.

### 2026-06-14 - Claude Code - Phase 4: Code Sandbox

Summary:
- Added a safe in-browser JavaScript scratchpad at `/sandbox`. Code runs in a Web Worker
  created from a Blob URL (no DOM or app access); the worker overrides `console.*` and
  streams output back, reports the value of the final expression, and a 2s watchdog
  `terminate()`s the worker if it runs too long - so an infinite loop can't freeze the
  tab. Ctrl/Cmd+Enter runs; code persists to localStorage. Zero server/API/schema
  dependency - identical with or without an API key.
- Added a Sandbox sidebar nav entry and a cross-link to it from the code-review aside.

Files touched:
- `apps/web/app/(app)/sandbox/page.tsx` (new)
- `apps/web/app/(app)/layout.tsx` (nav)
- `apps/web/app/(app)/code-review/page.tsx` (cross-link + Link import)
- `README.md`, `docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck` (all workspaces clean), `npm run build` (clean; `/sandbox` compiled).
- Browser QA as `alex@demo.edu`:
  - Run starter code -> `fib(10) = 55` plus the final-expression result `= [1, 4, 9, 16]`.
  - Error case (`notDefined.foo()`) -> prior logs print, then `! notDefined is not defined`
    in error styling.
  - Infinite loop (`while (true) {}`) -> terminated after 2s with the watchdog message,
    button returns to Run, and the main thread stayed responsive throughout (an eval ran
    fine during/after), proving the worker isolation works.
  - No console or server errors.

Notes:
- Web-only, JavaScript only (browser-native, no external runtime like Pyodide - keeps it
  instant and dependency-free).
- Browser QA gotcha in this environment: `preview_fill` / `preview_click` sometimes don't
  trigger React's controlled-input onChange / form onSubmit. Reliable workarounds:
  set inputs via the native value setter + dispatch an `input` event, submit a form via
  `form.requestSubmit()`, and click buttons via the element's own `.click()` from an eval.
- `next build` still needs the dev/preview server stopped first (EPERM on `.next/trace`).

Next steps:
- Remaining Phase 4: concept visualizer (AI-backed; give it a keyless fallback).
- Bring upvoting, leaderboard, annotations, and the sandbox into the native mobile app.

### 2026-06-14 - Claude Code - Production deploy prep (Vercel + Neon)

Summary:
- Made the app deployable to Vercel with a Neon (serverless PostgreSQL) database, WITHOUT
  disturbing local SQLite dev. Decision: keep `schema.prisma` on SQLite (single source of
  truth, zero-install local dev untouched for everyone) and DERIVE the production Postgres
  schema at build time.
  - `scripts/gen-prod-schema.mjs` writes `prisma/schema.prod.prisma` from `schema.prisma`
    by swapping only the datasource provider (sqlite -> postgresql). The generated file is
    gitignored.
  - db scripts: `generate:prod` (prisma generate against the prod schema), `push:prod`
    (`prisma db push` to create/update Neon tables, no migration files needed).
  - root scripts: `gen:prod-schema`, `db:push:prod`, and `vercel-build` =
    gen-prod-schema -> generate:prod -> push:prod -> next build.
  - `vercel.json` points Vercel at the monorepo root, framework nextjs, buildCommand
    `npm run vercel-build`, outputDirectory `apps/web/.next`.
- `auth.ts`: added `trustHost: true` so NextAuth works behind Vercel's proxy (avoids the
  common first-deploy UntrustedHost error). Documented `AUTH_TRUST_HOST` too.
- Upload route: returns a friendly 503 pointing to "Paste text" when `process.env.VERCEL`
  is set, since serverless filesystems are ephemeral (file uploads need object storage -
  a follow-up, not a launch blocker).
- `.env.example` updated with prod guidance; `docs/DEPLOY.md` is a full beginner-friendly
  Neon + Vercel walkthrough; README "Switching to PostgreSQL" replaced with a deploy
  pointer.

Files touched:
- `scripts/gen-prod-schema.mjs` (new), `vercel.json` (new), `docs/DEPLOY.md` (new)
- `package.json` (root scripts), `packages/db/package.json` (prod scripts)
- `apps/web/auth.ts`, `apps/web/app/api/upload/route.ts`
- `.gitignore`, `.env.example`, `README.md`, `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck` (all workspaces clean), `npm run build` (SQLite/CI path, clean).
- `npm run gen:prod-schema` -> wrote schema.prod.prisma.
- `prisma migrate diff --from-empty --to-schema-datamodel schema.prod.prisma --script`
  (offline) -> valid Postgres DDL for every table (TIMESTAMP(3), proper types). This is
  how the prod schema was validated without a live Postgres.
- `prisma generate --schema=schema.prod.prisma` with a dummy `postgresql://` URL ->
  generated the client OK (confirms the Vercel generate step). Restored the SQLite client
  afterwards with `npm run db:generate` so local dev isn't left on the Postgres client.

Notes / decisions:
- `prisma db push` (not migrate) for prod: no Postgres migration files to maintain, and the
  SQLite migration history under `prisma/migrations/` is SQLite-flavored SQL that would NOT
  apply on Postgres. db push syncs straight from the generated prod schema. For a future
  DESTRUCTIVE schema change on a populated prod DB, db push will stop rather than drop data.
- Production deliberately runs NO demo seed - `alex@demo.edu` etc. have a public password
  and must not exist on a live site. Real users sign up.
- Minor known divergence: Prisma `contains` is case-insensitive on SQLite but
  case-SENSITIVE on Postgres, so course/material search becomes case-sensitive in prod.
  Not a breakage; left as a post-launch polish item (can't add `mode: "insensitive"`
  unconditionally - it's invalid on SQLite).
- I CANNOT complete the actual go-live: it needs the user's Neon + Vercel accounts and
  secrets. The repo is fully prepared; the user follows docs/DEPLOY.md. The first real
  Postgres run happens during their first Vercel deploy (build runs `db push` to Neon).

Next steps:
- User: follow docs/DEPLOY.md (create Neon DB, import repo to Vercel, set DATABASE_URL +
  AUTH_SECRET + AUTH_TRUST_HOST, deploy).
- Later: object storage for real file uploads; concept visualizer; mobile Phase 4 parity.

### 2026-06-16 - Claude Code - Deployed to prod + personal-email signup, email verification

Deployment: I drove the user's browser (Chrome MCP) and the app is LIVE at
**https://hyntor.vercel.app** (Vercel project `hyntor`, team batorgilrb-7458s-projects).
Neon Postgres `hyntor-db` is connected via the Vercel-Neon integration (DATABASE_URL is an
integration var, not in the plain Project env list). Env set: AUTH_SECRET, AUTH_TRUST_HOST.
The vercel-build pipeline worked end to end (gen prod schema -> generate client -> db push
-> next build). Note: the Neon org is Vercel-managed, so new Neon projects must be created
from Vercel's Storage tab, not the Neon console.

Then, building on Codex's "Add Google authentication" (commit 25f3ce9), the user asked to
(1) allow personal-email signup, (2) keep Google sign-in, (3) add email verification by code.

Summary:
- Personal emails now allowed everywhere. `packages/api/src/auth.ts`: removed the
  isPersonalEmailDomain rejections in `signupUser` and `findOrCreateOAuthUser`; new
  `resolveUniversityId` gives personal/free-mail users their OWN isolated University
  (keyed `personal:<email>`, named "Independent learners") so Gmail strangers don't share
  a course graph; school-domain users still group by domain.
- Google sign-in: `apps/web/auth.ts` signIn callback no longer rejects personal domains
  (keeps the Google email_verified check). Google users are set emailVerified (no code).
- Email verification by 6-digit code (password signups):
  - DB: `User.emailVerified`, `pendingCodeHash`, `pendingCodeExpiresAt`
    (migration 20260616170000_add_email_verification). "Blocked until verified" keys on an
    OUTSTANDING `pendingCodeHash`, so pre-existing accounts + Google users are grandfathered
    in with NO backfill.
  - `packages/api/src/email.ts`: Resend via fetch (no npm dep) when `RESEND_API_KEY` set;
    otherwise logs the code and returns delivered:false (dev fallback).
  - auth.ts helpers `issueEmailCode` / `checkEmailCode`; user router `signup` (issues code,
    returns `{email, emailSent, devCode}`), `verifyEmail`, `resendCode`; credentials
    authorize + mobileLogin reject users with an outstanding code.
  - Web: new `/verify` page (code input, resend, dev-mode banner showing the code via
    sessionStorage when email unconfigured); signup -> /verify (no auto-login); login shows
    "Email verified!" on `?verified=1` + a "Verify your email" hint; copy relaxed from
    "university email" to "school or personal email".

Files touched:
- `packages/db/prisma/schema.prisma` + `migrations/20260616170000_add_email_verification/`
- `packages/core/src/constants.ts` (EMAIL_CODE_LENGTH, EMAIL_CODE_TTL_MINUTES)
- `packages/api/src/email.ts` (new), `packages/api/src/auth.ts`,
  `packages/api/src/routers/user.ts`
- `apps/web/auth.ts`, `apps/web/app/(auth)/verify/page.tsx` (new),
  `apps/web/app/(auth)/signup/page.tsx`, `apps/web/app/(auth)/login/page.tsx`
- `.env.example` (RESEND_API_KEY/EMAIL_FROM), `docs/DEPLOY.md`, `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck` (all workspaces clean), `npm run build` (clean; /verify compiled).
- Migration applied locally via diff+deploy (migrate dev still hangs in the agent shell).
- Browser QA (localhost): personal Gmail signup -> /verify with dev code 260215 -> verified
  -> /login?verified=1 -> logged in ("Hey Test", space "Independent learners"). Unverified
  second account -> login correctly BLOCKED ("Invalid email or password." + verify hint).
  Cleaned up both test accounts from dev.db afterward.

Open items for the USER (cannot be done without their accounts):
- Google: create OAuth credentials and set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET in Vercel
  (redirect URI https://hyntor.vercel.app/api/auth/callback/google). See DEPLOY.md Step 3.
- Email: add RESEND_API_KEY (+ verified domain via EMAIL_FROM to email arbitrary users);
  until then verification runs in dev-mode (code shown on screen). See DEPLOY.md.

### 2026-06-16 - Claude Code - User profile + landing page redesign

Also: completed the Google sign-in setup via browser - created the OAuth client in Google
Cloud (project "hyntor"), published the consent screen to production (External, basic
email/profile scopes so no verification needed), and set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET
in Vercel + redeployed. Redirect URI: https://hyntor.vercel.app/api/auth/callback/google.
Google sign-in is now live.

Summary:
- User profile: new `user.profile` query (name, email, role, xp, streak, createdAt,
  emailVerified, signInMethod google|password, study-space name + isPersonalSpace, and
  activity stats: courses/materialsShared/quizzesTaken/tutorSessions) and `user.updateProfile`
  (display name). New `/profile` page (initials avatar, inline name edit, stats grid,
  account details). The sidebar user block is now a link to /profile with an avatar.
- Landing page redesign (apps/web/app/page.tsx): polished gradient hero with product preview
  (tutor chat + tier badge), honest trust strip, "How it works" 3 steps, hint-tier section,
  feature grid, a dark "responsible AI" band, and a footer. REMOVED the publicly-advertised
  demo credentials (alex@demo.edu / coursemind) - those accounts don't exist in production
  and looked unprofessional. No fabricated stats/testimonials (kept it truthful).

Files touched:
- `packages/api/src/routers/user.ts` (profile, updateProfile)
- `apps/web/app/(app)/profile/page.tsx` (new)
- `apps/web/app/(app)/layout.tsx` (sidebar profile link + avatar)
- `apps/web/app/page.tsx` (landing redesign)
- `docs/AI_HANDOFF.md`

Checks run:
- `npm run typecheck` (all workspaces clean), `npm run build` (clean; /profile compiled).
- Browser QA (localhost): landing page renders all sections, no demo creds, no console
  errors. Profile page shows correct stats for alex@demo.edu (215 XP, 5d streak, 2 courses,
  etc.); inline name edit round-trips; sidebar avatar links to /profile.

Next steps:
- (Unchanged) USER: set RESEND_API_KEY for real verification emails (dev-mode shows code
  until then). Google sign-in + email verification + personal-email signup are all live.

### 2026-06-16 - Claude Code - Harden verification (no code leak in prod)

- The hosted site was returning the signup verification code to the client (dev
  fallback) because RESEND_API_KEY isn't set, which defeats verification. Fixed
  in `packages/api/src/routers/user.ts`: when `process.env.VERCEL` is set and no
  email provider is configured, `signup` throws PRECONDITION_FAILED ("use
  Continue with Google") instead of creating an unverifiable account; the code
  is only ever returned locally. `resendCode` gated the same way. typecheck clean.
- Net effect until RESEND_API_KEY is set: on prod, email/password signup is
  blocked (Google sign-in works); locally it still returns the code for testing.

BLOCKED on the user (cannot be automated): creating a Resend account / logging in
is account creation + auth, which the assistant can't do. Once the user logs into
Resend, the remaining steps (create API key, set RESEND_API_KEY in Vercel,
redeploy) are quick. Emailing arbitrary recipients also needs a verified sending
domain (a *.vercel.app subdomain can't be verified) - user needs a domain they own.

### 2026-06-16 - Claude Code - Pause email verification (provider-gated)

User asked to stop email verification for now. Made it provider-gated instead of
ripping it out (non-destructive, auto-resumes):
- Verification is enforced ONLY when an email provider is configured
  (`isEmailConfigured()` = RESEND_API_KEY set).
- No provider (current state): `user.signup` creates a ready-to-use account
  (emailVerified set, no code, no /verify) and returns `verificationRequired:false`;
  the signup page logs straight in. Credentials authorize + mobileLogin no longer
  block on a pending code. Removed the prod "email signup unavailable" throw.
- Provider set later: signup emails a code and requires /verify again - zero code
  changes needed to resume.

Files: `packages/api/src/index.ts` (export isEmailConfigured),
`packages/api/src/routers/user.ts`, `apps/web/auth.ts`,
`apps/web/app/(auth)/signup/page.tsx`.

Checks: `npm run typecheck` + `npm run build` clean. Browser: fresh email signup
(pause.test@gmail.com) went straight to /dashboard, account created with
emailVerified set + no pending code; no console errors; test account cleaned up.
The /verify page + resendCode remain in place (dormant until a provider is set).

### 2026-06-16 - Claude Code - Course group chat (free) + Pro plan with AI-in-chat (paid)

Per the user's product framing: free = share materials + chat as a class; paid (Pro) =
AI that reads the materials + the group's questions. Answers: "Both" (course-wide chat +
keep study groups) and "Plan + Upgrade placeholder" (no real billing yet).

- Schema (migration 20260616180000_course_chat_and_plan): ChatMessage now belongs to a
  workspace OR a course (workspaceId + courseId both nullable), authorId nullable (null =
  AI message) + `tier` column. User gains `plan` (FREE|PRO, default FREE).
- core: USER_PLANS constant. Reused buildDiscussionTutorPrompt for the chat AI.
- API: new `courseChat` router - list + send (any enrolled student, polling), and `askAi`
  (PRO-gated: reads recent chat + course materials via gatherGrounding, posts one grounded
  hint-tiered AI reply; returns {upgradeRequired:true} for FREE, AI-not-configured message
  if no key). `user.me`/`profile` return plan; `user.upgradeToPro` / `downgradeToFree`
  placeholders (flip the flag - Stripe hooks in here later). Fixed workspace.chatList for
  the now-nullable author.
- Web: `/courses/[id]/chat` live group chat with "Ask AI" (Pro; free users get an upgrade
  nudge). `/upgrade` pricing page (Free vs Pro $6/mo, instant placeholder upgrade/downgrade).
  Course page "Group chat" link; profile shows plan + Manage/Upgrade; sidebar shows a
  Pro badge or an "Upgrade to Pro" link.

Checks: typecheck + build clean. Browser QA (alex@demo.edu): sent a course-chat message
(posts + clears); Ask AI as FREE -> upgrade upsell; /upgrade -> "You're on Pro"; back on
chat the button ungates to "Ask AI" and (no local API key) shows the friendly
"AI not configured" notice = the Pro gate passes. Reset alex to FREE afterward.

Notes: AI replies in chat need ANTHROPIC_API_KEY (same as all AI features) - Pro gating +
plumbing verified, the model call reuses the proven discussion-tutor path. Existing
per-course discussion boards + study-group (workspace) chats are unchanged and still there.

### 2026-07-03 - Claude Code - Phase 4 complete + Blob uploads + new landing page

Summary:
- **Concept visualizer (final Phase 4 feature)**: `visualizer.generate` tRPC mutation maps a
  student-named concept into a small graph (core/concept/example/pitfall/practice nodes),
  AI-grounded in course materials via `buildConceptMapPrompt`; keyless fallback
  (`buildFallbackConceptMap` in `packages/core/src/visualizer.ts`) returns an honest offline
  study map. Web page `/visualizer` renders the graph as SVG (radial layout, click a node for
  its one-liner), nav entry `VZ`, "Visualize" link on the course page. All four phases now done on web.
- **Production file uploads**: upload route now writes to Vercel Blob when
  `BLOB_READ_WRITE_TOKEN` is set (enable via Vercel -> Storage -> Blob; docs/DEPLOY.md updated);
  local dev still uses apps/web/uploads/; hosted-without-blob keeps the friendly 503.
  Material page shows "Open original file" when fileUrl is http(s). New dep: @vercel/blob.
- **Landing page rebuilt (user request: "cluely.com-style, amazed")**: full dark marketing
  surface (#060a14) with animated glow orbs, gradient-shimmer headline, auto-playing typewriter
  hint-tier chat demo in the hero (components/landing/HeroDemo.tsx), fixed blur nav, course
  marquee, scroll-reveal sections (IntersectionObserver, no animation lib), bento feature grid,
  INTERACTIVE tier explorer (TierShowcase.tsx), stats band, Free/Pro pricing, big CTA.
  Animations are pure CSS in globals.css with prefers-reduced-motion support. App UI stays light.
- Cleaned stale `TODO Phase` comments (root.ts, schema.prisma isMockExam).

Files touched: packages/core/src/{visualizer.ts,prompts.ts,index.ts},
packages/api/src/routers/visualizer.ts, packages/api/src/root.ts, packages/db/prisma/schema.prisma
(comment only), apps/web/app/(app)/visualizer/page.tsx, apps/web/app/(app)/layout.tsx,
apps/web/app/(app)/courses/[courseId]/page.tsx, apps/web/app/(app)/materials/[materialId]/page.tsx,
apps/web/app/api/upload/route.ts, apps/web/app/page.tsx, apps/web/components/landing/*,
apps/web/app/globals.css, docs/DEPLOY.md, README.md.

Checks run: npm run typecheck (clean), apps/web next build (clean), browser-verified: landing
(desktop 1366px + mobile 375px, hero demo types + loops, tier explorer switches on click,
marquee/reveals animate, zero console errors) and /visualizer (offline map generates for a
course, node click shows detail, badge shows "AI not configured" state).

Open/next: mobile parity is PAUSED by user request. Stripe: USER IS BUILDING IT THEMSELVES -
do not implement billing; upgradeToPro/downgradeToFree remain placeholders for their work.
Email verification still paused (RESEND_API_KEY absent). AI features await ANTHROPIC_API_KEY.

### 2026-07-03 - Claude Code - Brand pass: logo, icons, library marketing, school recognition

Summary:
- **New logo mark** (components/ui.tsx LogoMark + app/icon.svg favicon): two rounded pillars +
  a tilted sheet passing between them - reads as an H; gradient squircle. Used in app sidebar,
  landing nav/footer, browser tab.
- **Real icons replace two-letter marks** across apps/web (new dep: lucide-react). MODE_META /
  WORKSPACE_TYPE_META / CONTEXT_TYPE_META now carry `icon: LucideIcon` instead of `mark: string`
  (touch points: sidebar NAV, tutor mode picker, discussion type chips, dashboard quick actions,
  workspace pages). Mobile untouched (paused).
- **Landing: AI hero KEPT by user request** ("Don't just get the answer. Actually learn it." +
  typewriter HeroDemo + "Your whole class, one brain" steps + tier showcase all restored after a
  library-first rewrite was walked back). Library is now marketed harder INSIDE that page: new
  "Materials outlive the semester" section (#legacy, semester bar chart: 12->43->84->You),
  bento reworked - big "One shared class library" tile (upvoted file rows) + "Real past exams"
  tile REPLACING the mock-exam and flashcard tiles; Pro pricing copy = "AI that has read
  everything your class ever shared". Footer: "(c) 2026 Hyntor. All rights reserved."
- **School auto-recognition**: new packages/api/src/universities.ts - curated domain->official
  name map (~280 schools worldwide incl. Mongolia) with subdomain walk-up; auth
  resolveUniversityId uses it (fallback: old prettifyDomain) and SELF-HEALS known rows' names on
  next signup (never touches unknown/hand-named rows, so "Demo University" survives). School
  courses already surface via schoolHub/course.browse (university-scoped).
- README intro rewritten: AI tagline kept, library+inheritance story added; root metadata same.

Product decisions recorded (user, July 3): AI hero copy IS the brand; library is the co-star;
Pro = "AI reads the whole class's library". Monetization: NO Anthropic rev-share exists - the
model is buy API wholesale, price Pro thin ($6/mo), margin = difference; usage caps are a
future task. Stripe still the USER'S to build.

Checks: typecheck clean, next build clean (18 pages), browser-verified (hero, #legacy bars,
tiers, (c) footer, icons+logo in app sidebar, zero console errors), resolver smoke-tested
(stanford/cs.stanford/num.edu.mn/u.nus.edu/unknown).

### 2026-07-03 - Claude Code - Signup email validity check (DNS) + school-name preview

Summary:
- **Signup now rejects emails on domains that can't receive mail.** New
  `emailDomainReceivesMail()` in packages/api/src/auth.ts: MX lookup first (c-ares), then a
  dns.lookup (OS resolver) existence fallback - ENOTFOUND/ENODATA => reject with a friendly
  "doesn't appear to be a real email domain" error; timeouts/flaky DNS FAIL OPEN so real
  students are never blocked. Known free-mail domains skip the lookup. Called from signupUser
  only (Google emails are already real). NOTE: full ownership proof still needs RESEND_API_KEY
  (paused verification flow auto-resumes when set) - this is deliverability, not ownership.
- **Signup school preview uses real names**: user.schoolRecognition's "new school" branch now
  consults lookupUniversityName, so typing student@yonsei.ac.kr shows "Yonsei University -
  School recognized" before the space even exists.
- Gotcha discovered: this dev sandbox blocks raw DNS (resolveMx/resolve4 => ECONNREFUSED for
  everything) but dns.lookup (getaddrinfo) works - which is why the OS-resolver fallback layer
  exists. Verified in-browser: fake domain rejected in the signup form, bad format caught by
  zod, mit.edu passes, yonsei.ac.kr previews correctly. Test users + junk university rows
  cleaned from the dev DB.

Files: packages/api/src/auth.ts, packages/api/src/routers/user.ts.
Checks: typecheck clean, next build clean, browser-verified via real signup form.
