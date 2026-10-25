# Hyntor — Project Testing Plan and CI/CD

**Milestone 3** · Due Friday, 6 November 2026 · Last updated 24 October 2026

| | |
| --- | --- |
| Repository | https://github.com/Hyntor/hyntor-ai |
| Pipeline | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Deployment | Render, from [`render.yaml`](../render.yaml) ([ADR-0011](adr/0011-deployment-render.md)) |
| Stack | Python 3.12+, Django 6.1, PostgreSQL in CI, SQLite in development ([ADR-0010](adr/0010-stack-python-django.md)) |
| Test runner | Django's built-in runner (`python manage.py test`) |
| Suite today | 75 tests, 89% line coverage |

---

## 1. Introduction

This plan states what Hyntor tests, what it deliberately does not test, how those tests run without anyone
remembering to run them, and who is accountable for each part.

Hyntor is a course library and AI tutor. Students sign up with a university email, share course materials
that persist across terms, and ask a tutor that answers from those materials with hints before full answers.
Three properties decide whether the product is trustworthy, and they shape everything below:

1. **Nobody sees another university's or another course's material.** An authorization mistake is the worst
   failure this system can have.
2. **Credentials are never recoverable from the database.** Passwords are Argon2id hashes; session tokens are
   stored only as SHA-256.
3. **The tutor hints before it answers, and cites what it used.** A tutor that hands over answers is an
   academic-integrity problem, not a feature.

The team writes tests by hand and with AI assistance. The rule we hold ourselves to is the course's: **no
test is submitted that its owner cannot explain.** A test nobody understands is removed before the deadline
rather than kept for the coverage number. Section 3 describes how we push AI past happy-path output, and
section 7 covers what happens when it produces something plausible but wrong.

### Scope of this plan

In scope: the Django application — models, views, authentication, the seed command, and the CI pipeline.

Out of scope for M3: deployment (CD) is not built yet; see section 7, risk R1.

---

## 2. CI/CD Pipeline Configuration

### How tests run automatically

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on GitHub Actions. Nobody runs it by hand, and
nobody can merge around it.

| Trigger | When it fires | Why |
| --- | --- | --- |
| `push` | Every commit pushed to any branch | A broken commit is caught before a pull request exists |
| `pull_request` into `main` | A PR is opened or updated | This is the run that branch protection requires |

`concurrency` with `cancel-in-progress` cancels the older run when a branch is pushed again, so three pushes
in a minute produce one meaningful result instead of three competing ones.

`permissions: contents: read` means the workflow can read the repository and nothing else. It cannot push,
comment or change settings, so a compromised dependency cannot use it to alter the project.

### The steps, in order

Cheap checks run first, so an obvious mistake fails in seconds rather than minutes.

| # | Step | What it catches |
| --- | --- | --- |
| 1 | `actions/checkout@v7` | — |
| 2 | `actions/setup-python@v7` (pip cache) | — |
| 3 | `pip install -r requirements-dev.txt` | A dependency that does not resolve |
| 4 | `ruff check .` | Unused imports, undefined names, likely bugs, security smells |
| 5 | `ruff format --check .` | Formatting drift (M3 style rubric) |
| 6 | `manage.py check` | Django misconfiguration |
| 7 | `manage.py makemigrations --check --dry-run` | **A model changed with no migration written** |
| 8 | `manage.py migrate --no-input` | A migration that does not apply to an empty database |
| 9 | `coverage run manage.py test` | The test suite |
| 10 | `coverage report --fail-under=85` | Coverage falling below the floor |
| 11 | `actions/upload-artifact@v7` | Saves the coverage data, including on failure |

Step 7 deserves a note: forgetting a migration does not break the tests, it breaks the *next deployment*.
Checking it in CI turns a production failure into a pull-request failure.

### Why a PostgreSQL service container

Development uses a SQLite file so a new machine needs no database server. Production uses PostgreSQL. CI runs
the `postgres:18` service container because **CI is the environment we trust**: a query that works on SQLite
and fails on PostgreSQL has to fail here, not after a deploy. The job waits on `pg_isready` health checks
before the first step, so no step races the database.

### Why there is no API key in CI

No `GEMINI_API_KEY` is set anywhere in the workflow, deliberately (N9, T6). The suite runs the no-key path, so
the pipeline cannot spend the team's quota, cannot leak a key into a public log, and cannot fail because a
third-party service is down. Tutor tests use a fake provider instead.

### Matrix

The job runs on Python 3.12 and 3.14: the oldest version we support and the one we develop on. `fail-fast:
false` lets both finish, so one failure does not hide the other's result.

### Branch protection

`main` requires a pull request with one approval, and the `ci` check must pass. Direct pushes are refused.

### CD

Continuous deployment (#13) is Render, configured in [`render.yaml`](../render.yaml)
([ADR-0011](adr/0011-deployment-render.md)). Both services track `main` with `autoDeployTrigger:
checksPass`: Render deploys a commit only after GitHub reports that this workflow passed on it. Together with
branch protection, a change reaches production only through a reviewed pull request with green CI. The build
applies migrations and runs the idempotent seed, so a deploy never needs a manual step. See risk R1.

---

## 3. Features To Be Tested

The emphasis is on boundaries and hostile input. "It works when you type the right password" is assumed, not
celebrated.

### 3.1 Already covered — 53 tests

**Password rules** — [`accounts/tests/test_passwords.py`](../accounts/tests/test_passwords.py)

| Case | Boundary or adversarial |
| --- | --- |
| 9 characters refused, 10 accepted, 11 accepted | The `<` versus `<=` boundary |
| Empty string | Smallest possible input |
| Whitespace-only, longer than the minimum | Passes a naive length check; must still be refused |
| Password is **not** trimmed | The email *is* trimmed — trimming the password too would let two strings open one account |
| A prefix of the password | Catches a comparison that stops at the shorter length |
| Null byte inside the password | Argon2 is a C library; in C a null byte ends a string |
| `café` composed vs. decomposed Unicode | Identical on screen, different bytes, therefore different passwords |
| SQL and HTML in the password | Must be ordinary characters; the ORM parameterizes every query |
| 10,000-character password | An attacker tying up a worker; Argon2's cost is memory, not input length |
| Same password hashed twice | Different salts, both still verify |
| Damaged hash in the database | Must return false, not a 500 page |

**Sessions** — [`accounts/tests/test_sessions.py`](../accounts/tests/test_sessions.py)

Raw token never stored; tokens are 256-bit and unique per sign-in; a tampered token fails; **one second
before expiry accepted, one second after refused**; ending one session leaves the user's other sessions alone.

**Sign-in and sign-out** — [`accounts/tests/test_login_view.py`](../accounts/tests/test_login_view.py)

Correct password signs in; wrong password and unknown email return **the same status and the same message**,
so the page cannot be used to discover which addresses have accounts; no session row is created on failure;
the cookie is `HttpOnly` and `SameSite=Lax`; a POST without a CSRF token is refused; a cookie captured before
logout cannot be replayed afterwards; a GET cannot trigger logout; an empty POST does not crash.

**Seed command** — [`accounts/tests/test_seed.py`](../accounts/tests/test_seed.py)

Running it twice leaves identical row counts (E2); accounts across two terms; Argon2id hashes only; every
material file is written to storage, and a deleted file is restored on the next run.

### 3.2 To be tested before 6 November

| Feature | Boundary and adversarial cases planned | Issue |
| --- | --- | --- |
| Signup | `@gmail.com` refused with **zero rows created**; uppercase domain accepted; `a@b@olemiss.edu`; 255+ character address; extra `platform_role=admin` field rejected (mass assignment); HTML in the display name stored verbatim and rendered escaped | #16 |
| Login throttling | 5th failure normal, 6th refused; just inside vs. just outside the 15-minute window; correct password while throttled still refused; one account from many IPs, one IP across many accounts | #17 |
| Course creation | Duplicate code differing only in case and spacing refused; same code at another university allowed; whitespace-only code refused; title at max length and max + 1; atomic rollback if the enrollment insert fails | #18 |
| Course library | A learner enrolling in a later term sees 100% of earlier terms' materials (G2); `%` and `_` in the filter treated literally; stable ordering when timestamps tie | #24 |
| Uploads | Wrong file type, oversized file, duplicate `sha256` in the same course, same file in another course allowed | #21 |
| Tutor tiers | Tier escalation computed server-side, never from the prompt; citations resolve to real chunks; "beyond materials" flagged | #27 |

### 3.3 Deliberately **not** tested

Naming these is as much a part of the plan as naming what is tested.

| Not tested | Why |
| --- | --- |
| Django, Argon2, psycopg internals | Third-party code with its own suites. We test *our* use of them. |
| The real Gemini API | Costs quota, needs a secret, and fails for reasons unrelated to our code. A fake provider is used instead. |
| Browser rendering and CSS | The UI is server-rendered HTML with no JavaScript framework; we assert on the HTML, not on pixels. |
| Load and performance | Out of scope for this release ([ADR-0009](adr/0009-scope.md)), beyond the one check that a huge password cannot stall a worker. |
| Deployment | No deployment exists yet (#13). |

### 3.4 How AI was guided past happy-path tests

This is the question the oral defense asks directly, so the honest sequence is recorded here.

**First pass.** Asking for "tests for the password validator" produced what you would expect: a valid
password passes, an invalid one fails. Correct, and nearly worthless — it exercised one branch of a
two-branch function.

**Second pass — boundaries.** Prompting for the *boundary* rather than the behaviour: *"the rule is at least
10 characters. Write the tests that distinguish `<` from `<=`, and include the smallest possible input."*
That produced the 9/10/11 and empty-string cases.

**Third pass — adversarial.** The question that produced the useful tests was not about the rule at all:
*"What input could an attacker send to this function, and what does the C library underneath do differently
from Python?"* That is where the null-byte, Unicode-normalization, no-trimming and 10,000-character cases came
from. Asking about the *implementation underneath the function* found cases that asking about the rule never
would.

**It found a real bug.** `test_a_damaged_hash_does_not_crash` failed on its first run: a corrupted hash raised
`InvalidHashError` instead of returning `False`, which would have been a 500 error on the login page.
`InvalidHashError` subclasses `ValueError`, not `VerificationError`, so the original `except` clause missed
it. Fixed in [`accounts/passwords.py`](../accounts/passwords.py).

Each member records their own prompts and failures in the M3 AI usage log (#33) as the sprint happens.

---

## 4. Test Environment Needs

### Local

| Need | Detail |
| --- | --- |
| Python | 3.12 or newer; 3.14 is what the team develops on |
| Dependencies | `pip install -r requirements-dev.txt` |
| Database | None to install. Tests create and destroy their own SQLite database. |
| Secrets | None. `cp .env.example .env` and the defaults work. |
| Command | `python manage.py test` |
| Runtime | Under 10 seconds for the whole suite |

Tests never touch `dev.sqlite3` or the real `.storage` directory: Django creates a separate test database,
and the seed tests write into a temporary directory.

### CI

GitHub Actions `ubuntu-latest`, `postgres:18` service container, pip cache, no secrets of any kind.

### Test data

Built in the test itself, not shared between tests. Django wraps each test in a transaction and rolls it back,
so tests cannot leak state into one another and can run in any order. Password tests use `SimpleTestCase`,
which creates no database at all, because hashing does not touch one.

---

## 5. Responsibilities

Each member owns the tests for the code they write, and must be able to explain both in the defense.

| Member | Role | Owns the tests for |
| --- | --- | --- |
| Bat-Orgil Erdenebat | QA / Security Lead | Test harness and fixtures, the fake AI provider, the security review, the coverage floor (#9, #30, #31) |
| Cederius Johnson | Integration Specialist | `ci.yml`, lint and formatting configuration, branch protection, deployment (#7, #8, #13) |
| Sejan Dhakal | Systems Architect | Model and migration tests, view and form conventions, the data layer (#10, #12) |
| Addison Brawley | Product Owner | Accounts and sign-in, the seed command, the course library (#11, #15, #16, #24) |

Shared, and not one person's job: every member can explain the whole pipeline, because the defense selects
members at random.

> **Confirm this table at the next sprint meeting.** It is derived from the current issue assignments; the
> team has not formally agreed to it.

---

## 6. Schedule

| Date | Work | Owner |
| --- | --- | --- |
| Fri 24 Oct | Pipeline running; accounts and seed tests (53 tests, 90%) | Addison |
| Mon 27 Oct | `ci` set as a required status check; branch protection verified by a deliberate failing push | Cederius |
| Mon 27 Oct | Shared fixtures and the fake AI provider (#9) | Bat-Orgil |
| Wed 29 Oct | Signup and throttling tests (#16, #17) | Addison |
| Wed 29 Oct | Model, migration and authorization tests (#10, #12) | Sejan |
| Fri 31 Oct | Upload and library tests (#21, #24); enrollment-across-terms case (G2) | Sejan, Addison |
| Mon 3 Nov | Tutor tier and citation tests (#27) | Bat-Orgil |
| Tue 4 Nov | Security review (#30); coverage floor raised to the measured value | Bat-Orgil |
| Wed 5 Nov | **Mock defense:** repository projected, members picked at random, rubric questions asked | Whole team |
| Wed 5 Nov | Any test nobody can explain is rewritten or deleted | Whole team |
| Thu 5 Nov | This document finalized; AI usage log assembled (#33) | Addison |
| **Fri 6 Nov** | **Submission and live oral defense** | Whole team |

---

## 7. Risks and Contingencies

**R1 — Deployment is configured but not yet proven.** *Possible, high impact.* Resolved in part on 24
October: the host is Render, described by [`render.yaml`](../render.yaml) in the repository
([ADR-0011](adr/0011-deployment-render.md)), with Django, the Streamlit tutor and PostgreSQL. Render
deploys each commit on `main` once CI passes on it (#13). What is unproven is the first deploy: nothing has run on
Render yet, and `render.yaml` cannot be tested locally.
*Contingency:* deploy by 27 October, well before the deadline, so the first failures surface early. Two
known expiry traps: Render's free PostgreSQL lasts 30 days and must be recreated before the M5 demo on 10
December, and free services sleep when idle, so both pages are opened before any demo.

**R2 — A member cannot explain a test they submitted.** *Possible, severe — it is an individual grade.*
*Contingency:* the mock defense on 5 November is the checkpoint. Anything its owner cannot explain is deleted,
even if it is correct and even if coverage drops. A lower coverage number costs fewer points than a failed
individual defense.

**R3 — AI-generated tests that pass but assert nothing useful.** *Likely, medium.* A generated test can
assert the behaviour of a mock it also defined, or re-test the framework.
*Contingency:* every test must name what breaks if it is deleted, which is what the docstrings in the current
suite do. Reviewers reject tests without one. Mutation-style spot checks: break the code on purpose and
confirm a test goes red.

**R4 — The stack changed 12 days before the deadline.** *Already happened, medium ongoing impact.* The
project moved from TypeScript to Python on 24 October ([ADR-0010](adr/0010-stack-python-django.md)), so
issues #6, #10, #11 were redone and #12 is void.
*Contingency:* the backlog is re-pointed at the next sprint meeting. Accounts is finished first, because
every other feature depends on sign-in.

**R5 — SQLite and PostgreSQL disagree.** *Possible, medium.* Development and production use different
engines, so a query can pass locally and fail in CI.
*Contingency:* CI is the authority, and it runs PostgreSQL. Nothing merges on a local pass alone. Any
difference found is written into the plan and the ADR.

**R6 — Time-dependent tests become flaky.** *Possible, low.* Session expiry is tested one second either side
of the boundary, which is tight enough to be fragile on a slow CI machine.
*Contingency:* the tests set `expires_at` explicitly rather than sleeping, so they do not depend on real
elapsed time. If a flake appears anyway, the window widens or the clock is injected.

**R7 — Coverage treated as the goal.** *Possible, medium.* 90% of lines executed is not 90% of behaviour
checked, and a floor invites gaming.
*Contingency:* the floor only ever rises, and review asks for the boundary cases a feature needs, not for a
number. Authorization, tier logic and upload validation are reported separately because they matter most.

**R8 — The pipeline is red and nobody can diagnose it.** *Possible, medium — the defense asks about exactly
this.*
*Contingency:* the troubleshooting procedure below, which every member can walk through.

### Troubleshooting a red pipeline

The defense asks each member to diagnose a broken pipeline end to end. The order is deliberate: read before
guessing, reproduce before fixing.

1. **Read which step failed**, on the pull request's Checks tab. The step name says what kind of failure it
   is — lint, formatting, migrations, tests or coverage.
2. **Reproduce it locally** with the same command the workflow ran. Every step is one command that works on a
   laptop; there is nothing CI-only to guess at.
3. **If it passes locally but fails in CI**, the difference is the environment, and there are only three:
   PostgreSQL instead of SQLite, `DEBUG=0`, and no API key. Reproduce with
   `DJANGO_DEBUG=0 DATABASE_URL=postgres://... python manage.py test`.
4. **If it is the migration check**, run `python manage.py makemigrations`, commit what it writes.
5. **If it is coverage**, download the coverage artifact from the run and read which lines are untested.
6. **Fix on the branch and push.** The old run cancels, a new one starts. `main` is never the place a fix is
   tested.
