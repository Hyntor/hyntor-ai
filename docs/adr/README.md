# Architecture decision records

One file per decision: context, decision, alternatives, consequences. A record starts as **Proposed** and
becomes **Accepted** once all four members have read it in the PR that adds it (ADR-1, #5). A record is never
edited to reverse a decision; a new record supersedes it.

| ADR                                 | Decision                                                             | Status   |
| ----------------------------------- | -------------------------------------------------------------------- | -------- |
| [0001](0001-stack.md)               | Next.js 15 + TypeScript + Tailwind, tRPC v11, Prisma, npm workspaces | Proposed |
| [0002](0002-database.md)            | SQLite in dev, PostgreSQL in CI and prod, from one schema file       | Proposed |
| [0003](0003-ai-provider.md)         | Gemini, server-side only, behind one `AiProvider` module             | Proposed |
| [0004](0004-retrieval.md)           | Keyword retrieval over chunks; no embeddings in this release         | Proposed |
| [0005](0005-file-storage.md)        | Local disk in dev, blob storage in prod, behind one interface        | Proposed |
| [0006](0006-text-extraction.md)     | `unpdf`, `mammoth`, `officeparser` for PDF, DOCX, PPTX               | Proposed |
| [0007](0007-authentication.md)      | Own `Session` table + Argon2id via `@node-rs/argon2`                 | Proposed |
| [0008](0008-testing-and-hosting.md) | Vitest; Vercel + managed PostgreSQL                                  | Proposed |
| [0009](0009-scope.md)               | Iteration 2/3 features and the mobile client are out of this release | Proposed |
