# AGENTS.md

## Shared AI Context

This repository is the Hyntor project, formerly Hyntor.

Hyntor is a student-first class study platform. Students join courses and share the class materials that matter for studying: lecture notes, slides, homework prompts, tests, practice exams, discussion context, and other course files. The point is not just "AI tutoring from uploaded notes"; the app gives the AI enough class-specific context to help students understand what their professor is teaching and prepare for that class.

The core product promise is: AI help that knows the class, helps students learn, and does not become an answer-vending machine for graded work.

## Product Principles

- Shared course libraries are central. One student's upload should make the course workspace more useful for everyone enrolled.
- The AI should use class materials, homework/test context, and course discussions to give relevant help.
- For concept questions, the AI can explain fully and generously.
- For graded or likely-graded work, the AI should guide with hints, questions, analogous examples, and structured walkthroughs rather than handing over final submittable answers.
- The existing hint-tier system is a product differentiator, not a side feature.
- The product should feel student-native, fast, useful, and trustworthy.
- The current preferred brand name is Hyntor, pronounced "HIN-tor", from hint + tutor.

## Architecture

- Web app: Next.js App Router, TypeScript, Tailwind in `apps/web`.
- Mobile app: Expo Router, TypeScript in `apps/mobile`.
- API/business logic: tRPC in `packages/api`.
- Shared types, constants, and AI prompts: `packages/core`.
- Database: Prisma in `packages/db`.
- Development DB is SQLite; production can move to PostgreSQL.
- AI provider is currently Anthropic through `ANTHROPIC_API_KEY`.

## Coordination Rules

- Before starting work, run `git status --short`.
- Read `docs/AI_HANDOFF.md` before making changes.
- Do not overwrite or revert work from the user or another agent.
- If another agent has uncommitted changes in a file, inspect carefully before editing that file.
- Keep changes small and scoped to the user's request.
- After meaningful work, update `docs/AI_HANDOFF.md` with:
  - date/time if relevant,
  - what changed,
  - files touched,
  - tests or checks run,
  - open questions or next steps.

## Current Project Notes

- Existing docs still use the old Hyntor name in many places. Treat Hyntor as the likely new brand unless the user says otherwise.
- Do not mechanically rename everything until the user explicitly asks for a full rename pass.
- Be careful with claims around sharing homework and tests. The product can support course context, homework prompts, tests, and practice materials, but UX and policy copy should still distinguish learning help from answer dumping.
- If changing AI behavior, review `packages/core/src/prompts.ts` and the relevant API routers in `packages/api/src/routers`.

## Verification

- For TypeScript or API changes, prefer `npm run typecheck`.
- For web UI changes, run the app with `npm run dev` and verify in a browser when feasible.
- For database schema changes, run Prisma generation/migration commands only when the change requires it.
