# hyntor-ai

Hyntor is a course library and AI tutor: students share materials for a course across terms, and the tutor
answers from those materials with hints before full answers.

Built with Python and Django, server-rendered HTML and CSS. Architecture decisions are in
[docs/adr](docs/adr/README.md); start with [0010](docs/adr/0010-stack-python-django.md).

## Run locally

### Prerequisites

- **Python 3.14** (`python --version`)
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

# 3. Install dependencies
pip install -r requirements.txt

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
tutor/        TutorSession, TutorMessage, MessageCitation
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
