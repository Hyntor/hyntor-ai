# Architecture decision records

One file per decision: context, decision, alternatives, consequences. A record starts as **Proposed** and
becomes **Accepted** once all four members have read it in the PR that adds it (ADR-1, #5). A record is never
edited to reverse a decision; a new record supersedes it.

| ADR                                        | Decision                                                             | Status                   |
| ------------------------------------------ | -------------------------------------------------------------------- | ------------------------ |
| [0001](0001-stack.md)                      | Next.js 15 + TypeScript + Tailwind, tRPC v11, Prisma, npm workspaces | Superseded by 0010       |
| [0002](0002-database.md)                   | SQLite in dev, PostgreSQL in CI and prod, from one schema file       | Proposed, amended by 0010 |
| [0003](0003-ai-provider.md)                | Gemini, server-side only, behind one provider module                 | Proposed, amended by 0010 |
| [0004](0004-retrieval.md)                  | Keyword retrieval over chunks; no embeddings in this release         | Proposed, amended by 0011 |
| [0005](0005-file-storage.md)               | Local disk in dev, blob storage in prod, behind one interface        | Proposed, amended by 0010 |
| [0006](0006-text-extraction.md)            | In-process extraction for PDF, DOCX, PPTX                            | Proposed, amended by 0010 |
| [0007](0007-authentication.md)             | Own `Session` table + Argon2id                                       | Proposed, amended by 0010 |
| [0008](0008-testing-and-hosting.md)        | Test runner and hosting target                                       | Hosting superseded by 0011 |
| [0009](0009-scope.md)                      | Iteration 2/3 features and the mobile client are out of this release | Proposed                 |
| [0010](0010-stack-python-django.md)        | **Python 3.12+ + Django 6.1, server-rendered HTML and CSS**          | Proposed                 |
| [0011](0011-deployment-render.md)          | **Render; Streamlit tutor as a second service behind a signed token** | Proposed                 |

Read **0010 first**: it replaces 0001 and restates the parts of 0002, 0003, 0005, 0006, 0007 and 0008 that
the move from TypeScript to Python changes. The earlier records are kept so the reasoning stays on the
record, which the M4 defense asks about directly.
