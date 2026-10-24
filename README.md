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

Render, described by [`render.yaml`](render.yaml): the Django site, the tutor and PostgreSQL. Connect the
repository as a Blueprint and set `GEMINI_API_KEY` in the dashboard; everything else, including the shared
hand-off secret, is wired up by the Blueprint.

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
