# 0010 Stack: Python and Django

**Status:** Proposed · **Supersedes:** [0001](0001-stack.md) · **Amends:** [0002](0002-database.md),
[0003](0003-ai-provider.md), [0005](0005-file-storage.md), [0006](0006-text-extraction.md),
[0007](0007-authentication.md), [0008](0008-testing-and-hosting.md) · **Date:** 2026-10-24

## Context

ADR-0001 chose TypeScript end to end: Next.js, tRPC and Prisma. That decision optimized for type safety
across the client/server boundary. It did not weigh the thing that turns out to matter most to this team's
grade.

M3 and M4 each include a **100-point individual oral defense**. The instructor projects the repository, picks
members and files at random, and asks them to explain syntax, control flow, Big-O and architectural context.
The M4 rubric states that failing to explain code you submitted fails the individual portion *regardless of
whether the software works*. All four members are substantially stronger in Python than in TypeScript.

A stack nobody can defend costs more points than an elegant one earns. The team agreed on 2026-10-24 to
switch while the codebase is still small: four days of work exists, and M3 is due 2026-11-06.

## Decision

**Python 3.14 with Django 6.1 for the whole application**, server-rendered HTML with plain CSS. No
JavaScript framework; no JavaScript at all unless a feature needs it.

| Concern | Was (ADR-0001) | Now |
| --- | --- | --- |
| Language | TypeScript | Python 3.14 |
| Web framework | Next.js 15 (App Router) | Django 6.1 |
| UI | React components (`.tsx`) | Django templates (`.html`) + CSS |
| API style | tRPC procedures | Django views and URLs |
| ORM | Prisma | Django ORM |
| Migrations | Prisma Migrate | Django migrations |
| Validation | Zod schemas | Django forms and model constraints |
| Packages | npm workspaces | one virtualenv, `requirements.txt` |

Layout: one Django project (`hyntor/`) and one app per epic, so every module has a named owner (DEL-8).

```
hyntor/      settings, urls, the home view
accounts/    University, User, Session; sign in and sign out
courses/     Course, Enrollment
library/     Material, MaterialChunk
tutor/       TutorSession, TutorMessage, MessageCitation
templates/   base.html and one template per page
static/css/  app.css
seed/files/  the demo materials
```

`django.contrib.auth` is deliberately **not** installed. Hyntor has its own `User` and `Session` models from
the ERD, and installing the auth app would add `auth_permission`, `auth_group` and `django_content_type`
tables that the ERD does not have. Passwords are hashed with `argon2-cffi` directly.

### What this changes in the other records

- **0002 Database.** Obsolete in the best way. Django reads one `DATABASE_URL` and talks to SQLite or
  PostgreSQL from the same settings file and the same migrations, so the generated-schema-copy workaround is
  gone. Development uses SQLite with no server to install; CI and production set `DATABASE_URL` to
  PostgreSQL. N10 is satisfied more simply than before.
- **0003 AI provider.** Gemini still, through `google-genai` 2.33.0 (Apache-2.0), the official Python SDK.
- **0005 File storage.** The `FileStore` interface becomes Django's storage backend API, which already has
  the local/remote split built in. Vercel Blob is dropped with Vercel (below).
- **0006 Text extraction.** The original pipeline diagram named pypdf and python-docx and ADR-0006 rejected
  them only because they are not TypeScript. That objection is gone: `pypdf` 6.21.2, `python-docx` 1.2.0 and
  `python-pptx` 1.0.2 now run in-process. The diagram and the code agree again.
- **0007 Authentication.** Unchanged in substance: our own `Session` table, a random 256-bit token in the
  cookie, only its SHA-256 hash stored. The package changes from `@node-rs/argon2` to `argon2-cffi` 25.1.0,
  which defaults to Argon2id.
- **0008 Testing and hosting.** Vitest becomes Django's own test runner (`python manage.py test`), which is
  `unittest` with a database harness around it. It was chosen over `pytest-django` deliberately: it needs no
  extra dependency, no plugin and no `conftest.py`, so a test file is a class with methods and nothing else
  to explain in the defense. **Vercel is
  dropped**: it is built for Next.js and runs Python only as serverless functions. A long-running host
  (Render, Railway or Fly.io) with managed PostgreSQL replaces it, served by `gunicorn` 26.2.0 with
  `whitenoise` 6.12.0 for static files. The exact host is still open and is recorded in a follow-up ADR
  before FND-8 (#13).

Every version above was checked on PyPI on 2026-10-24: it exists, is current, is maintained and carries a
permissive license.

## Alternatives

- **Stay on TypeScript and pair on it.** Cheapest in engineering time, and the only option with no rework.
  Rejected because the defenses are individual and four people cannot become fluent by November 6.
- **FastAPI with SQLAlchemy, Alembic and Jinja.** Also all Python, and more explicit. Rejected because it
  hands us three choices to make and defend where Django gives one, and because migrations, the ORM, CSRF
  protection and the admin are already wired together in Django.
- **Python backend with the React frontend kept.** Rejected: two runtimes, two deployments, validation
  written twice, and the team would still have to defend the TypeScript half.
- **Django REST Framework with a JavaScript frontend.** Same objection; the pages here are forms and lists,
  which server-rendered HTML handles without a client-side framework.

## Consequences

- **Rework.** #6 (scaffold), #10 (schema and migrations) and #11 (seed) are redone in Python; #12 (tRPC
  conventions) is void and is rewritten as Django view and form conventions. #7 (lint) becomes `ruff`, and #8
  (CI) runs `pip` and `pytest` instead of `npm`.
- **End-to-end type safety is gone.** This was ADR-0001's main argument. Renaming a model field no longer
  breaks a template at compile time; it breaks at request time instead. Tests and `ruff` have to carry the
  weight that the compiler carried, which is a real cost that we accept.
- **One process, one language, one deploy**, and every file is one that a member can read aloud and explain.
- The ERD is unchanged. Field names move from `camelCase` to Django's `snake_case`, and the two composite
  primary keys in the ERD (`Enrollment`, `MessageCitation`) are enforced as unique constraints over a
  surrogate key, because Django's related managers expect a single-column primary key.
