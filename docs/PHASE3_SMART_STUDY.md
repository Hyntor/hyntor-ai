# Phase 3 Smart Study

Phase 3 is now live as a web/API vertical slice for course-level studying, with a native
mobile read-only Smart Study surface consuming the same API.

## What Shipped

- Course Smart Study hub at `apps/web/app/(app)/courses/[courseId]/study/page.tsx`.
- Course-page entry point from `apps/web/app/(app)/courses/[courseId]/page.tsx`.
- Study plan creation and day completion tracking through `study.createPlan` and `study.toggleDay`.
- Weak-topic radar from `QuizAttempt.weakTopics`.
- Flashcard generation from readable course materials through `flashcard.generate`.
- SM-2 spaced repetition review through `flashcard.review`.
- Mock exam generation through `quiz.generateMockExam`.
- Responsive authenticated app shell in `apps/web/app/(app)/layout.tsx`.
- Native mobile Smart Study route at `apps/mobile/src/app/study/[courseId].tsx`.
- Native course detail entry point from `apps/mobile/src/app/course/[id].tsx`.
- Syllabus Autopilot on the web Smart Study page: paste a syllabus to save it as a
  `SYLLABUS` material, extract dated milestones, and generate a deadline-aware
  study plan.

## Backend Shape

API routers:

- `packages/api/src/routers/study.ts`
  - `overview`: dashboard-level Smart Study summary across enrolled courses.
  - `courseDashboard`: course materials, latest plans, flashcard counts, weak-topic counts.
  - `importSyllabus`: saves pasted syllabi, extracts dated course milestones, and creates
    a workback schedule.
  - `createPlan`: creates a `StudyPlan.schedule` JSON payload.
  - `toggleDay`: marks a study-plan day complete/incomplete.
- `packages/api/src/routers/flashcard.ts`
  - `due`: returns cards due for review with preview intervals.
  - `generate`: creates cards from one readable material.
  - `review`: applies the SM-2 scheduler and updates the card.
- `packages/api/src/routers/quiz.ts`
  - `generateMockExam`: creates a timed `Quiz` with `isMockExam = true`.

Core helpers:

- `packages/core/src/sm2.ts`: deterministic SM-2 review scheduling.
- `packages/core/src/studyplan.ts`: deterministic no-key fallback study plans.
- `packages/core/src/syllabus.ts`: deterministic syllabus date extraction fallback and
  deadline-aware schedule generation.
- `packages/core/src/prompts.ts`: AI prompts for mock exams, flashcards, and study plans.

## AI-Key Behavior

Study plans and flashcards work without an Anthropic key:

- Study plans use `buildFallbackStudyPlan`.
- Syllabus Autopilot uses deterministic date extraction when AI is unavailable.
- Flashcards fall back to deterministic sentence-based cards from extracted material text.

Mock exams require `ANTHROPIC_API_KEY`, because whole-course exam generation needs the model.
When the key is missing, the UI shows the standard friendly setup message instead of crashing.
When the key is present, Syllabus Autopilot asks Claude for structured milestone extraction and
falls back to deterministic parsing if that call fails.

## Data Model

No migration was required. The Phase 3 schema already existed:

- `StudyPlan.schedule`: JSON `StudyPlanDay[]`.
  - Syllabus Autopilot adds optional `kind`, `source`, and `milestoneType` fields for
    deadline-aware rows. Older schedules parse as normal study rows.
- `Flashcard`: `front`, `back`, `nextReviewAt`, `easeFactor`, `intervalDays`, `repetitions`.
- `Quiz.isMockExam` and `Quiz.timeLimit`.
- `QuizAttempt.weakTopics`.

## Verification

Verified on 2026-06-12:

- `npm run typecheck`
- `npx tsc --noEmit` from `apps/mobile`
- `npm run build`
- Browser QA on `http://localhost:3000/courses/cmq8qy9t00007oetsgyv8u3nh/study`
  - demo login works,
  - course page shows Smart Study entry point,
  - Smart Study route renders,
  - study plan creation works,
  - study-plan day checkbox persists,
  - flashcard generation works without an API key,
  - flashcard reveal and SM-2 review update the queue,
  - mock exam button shows the no-key setup message,
  - desktop and mobile viewport checks have no console errors.

Native mobile verification:

- `apps/mobile/src/app/course/[id].tsx` links to `/study/[courseId]`.
- `apps/mobile/src/app/study/[courseId].tsx` renders course pulse, weak-topic radar,
  latest schedule, and flashcard-source stats.
- Mobile source text was checked for non-ASCII/corrupted glyphs after the native update.
