# hyntor-ai

Hyntor is a course library and AI tutor: students share materials for a course across terms, and the tutor
answers from those materials with hints before full answers.

Built with Python and Django, server-rendered HTML and CSS. Architecture decisions are in
[docs/adr](docs/adr/README.md); start with [0010](docs/adr/0010-stack-python-django.md).

## Run locally

### Prerequisites

- **Python 3.12 or newer** (`python --version`). CI tests 3.12 and 3.14.
- Git
- Nothing else: development uses a SQLite file, so there is no database server to install

### Steps

```sh
# 1. Clone
git clone https://github.com/Hyntor/hyntor-ai.git
cd hyntor-ai

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash)
# .venv\Scripts\Activate.ps1       # Windows (PowerShell)
# source .venv/bin/activate        # macOS and Linux

# 3. Install dependencies (requirements-dev.txt adds the linter and coverage)
pip install -r requirements-dev.txt

# 4. Environment: the defaults work as-is for local development
cp .env.example .env

# 5. Create the database schema
python manage.py migrate

# 6. Load the demo data (safe to run again: it creates nothing the second time)
python manage.py seed

# 7. Start the site at http://localhost:8000
python manage.py runserver
```

### Demo accounts

All seeded accounts use the password `hyntor-demo-password`.

| Email                    | Role                                                  |
| ------------------------ | ----------------------------------------------------- |
| `learner1@example.edu`   | Learner, enrolled in CSCI 1010 in 2026-SP             |
| `learner2@example.edu`   | Learner, enrolled in CSCI 1010 in 2026-FA             |
| `maintainer@example.edu` | Course maintainer of CSCI 1010 in 2026-SP and 2026-FA |
| `admin@example.edu`      | Platform administrator                                |

The demo course has three materials (PDF, DOCX, PPTX) from `seed/files/`. They are notes the team wrote for
the demo, not course files.

### Starting over

```sh
python manage.py reset_demo   # drops all data and stored files, re-applies migrations, seeds
```

## Sign in with Google

Optional. With `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unset, the button is hidden and
password sign-in works as usual.

To switch it on, create an OAuth client in Google Cloud Console (APIs & Services -> Credentials ->
Create credentials -> OAuth client ID -> Web application) and register the callback address:

```
http://localhost:8000/auth/google/callback/        development
https://<your-render-host>/auth/google/callback/   production
```

Put the client ID and secret in `.env` locally, and in the Render dashboard for the deployed site.

Signing in with Google also **confirms the email address**: Google tells us whether it has verified
it, and that is what sets `email_verified_at` ([ADR-0012](docs/adr/0012-google-sign-in.md)). An
account created with a password becomes verified the first time it signs in with Google at the same
address. The email's domain must still belong to a registered university either way.

## The AI tutor

The tutor is a Streamlit app in [`tutor_chat/`](tutor_chat/), adapted from
[BatOrgil7/multi-modal-ai-chatbot-rag](https://github.com/BatOrgil7/multi-modal-ai-chatbot-rag). It runs as
its own service and never sees a password: Django checks the sign-in, then sends the browser on with a
short-lived signed token ([ADR-0011](docs/adr/0011-deployment-render.md)).

Run it locally alongside the Django site, in a second terminal:

```sh
export GEMINI_API_KEY="your-key"            # or set it in .env
export HANDOFF_SECRET="any-shared-string"   # must match the Django site's value
export HYNTOR_SITE_URL="http://localhost:8000"
streamlit run tutor_chat/AI_Chatbot.py --server.port 8501
```

Then set `TUTOR_CHAT_URL="http://localhost:8501"` in `.env`, restart Django, sign in, and use the
"Open the AI tutor" link. Opening `http://localhost:8501` directly is refused: there is no token.

Without `GEMINI_API_KEY` the tutor says it is not configured rather than crashing, and the rest of
Hyntor works normally.

## Deployment

Render, described by [`render.yaml`](render.yaml): the Django site, the tutor and PostgreSQL.

**Continuous deployment.** Merging into `main` deploys both services, but only once the `ci` workflow has
passed on that commit (`autoDeployTrigger: checksPass`). A commit with failing tests is never deployed. Each
deploy installs dependencies, collects static files, applies migrations and seeds the demo accounts (a no-op
after the first time).

**First-time setup** (once, by someone with access to the Render workspace):

1. In the Render dashboard: **New > Blueprint**, connect the `Hyntor/hyntor-ai` GitHub repository, branch
   `main`. Render reads `render.yaml` and proposes `hyntor-web`, `hyntor-tutor` and `hyntor-db`.
2. It asks for the two values marked `sync: false`:
   - `SEED_PASSWORD` (hyntor-web): the password for the demo accounts on the live site. Do not reuse the
     README's demo password; the site is public and one account is an admin. Share it with the team privately.
   - `GEMINI_API_KEY` (hyntor-tutor): optional; without it the tutor shows a setup notice.
3. **Apply**. The first deploy takes a few minutes. The site is then at the `hyntor-web` URL shown in the
   dashboard. Everything else, including the shared hand-off secret, is wired up by the Blueprint.

Free-tier limits: services sleep when idle and take about a minute to wake (open both pages before a demo),
and the free database expires after 30 days (see [ADR-0011](docs/adr/0011-deployment-render.md)).

## Testing

```sh
python manage.py test          # the whole suite
ruff check .                   # lint
ruff format .                  # format
coverage run manage.py test && coverage report
```

The same commands run in CI on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). What is tested, what is deliberately not, and who
owns what is in the [testing plan](docs/testing-plan.md).

## Commands

| Command                            | What it does                                              |
| ---------------------------------- | --------------------------------------------------------- |
| `python manage.py runserver`       | Development server on http://localhost:8000               |
| `python manage.py migrate`         | Apply migrations                                          |
| `python manage.py makemigrations`  | Write a migration after changing a model                  |
| `python manage.py seed`            | Load the demo data (idempotent)                           |
| `python manage.py reset_demo`      | Drop, migrate, seed                                       |
| `python manage.py check`           | Django system checks                                      |
| `python manage.py check --deploy`  | Extra checks for a production configuration               |

## Repository layout

```
hyntor/       Django project: settings, URLs, the home view
accounts/     University, User, Session; sign in and sign out
courses/      Course, Enrollment
library/      Material, MaterialChunk
tutor/        TutorSession, TutorMessage, MessageCitation; the hand-off into the tutor
tutor_chat/   the Streamlit tutor service and the shared hand-off token
templates/    base.html and one template per page
static/css/   app.css
seed/files/   demo materials loaded by `manage.py seed`
docs/adr/     architecture decision records
```

## Database

SQLite in development, with no configuration. CI and production set `DATABASE_URL` to PostgreSQL:

```sh
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/hyntor"
```

The same models and the same migrations serve both.
