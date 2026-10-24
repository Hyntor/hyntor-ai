# 0011 Deployment on Render, and the Streamlit tutor as a second service

**Status:** Proposed · **Supersedes the hosting half of** [0008](0008-testing-and-hosting.md) ·
**Amends** [0003](0003-ai-provider.md), [0004](0004-retrieval.md), [0010](0010-stack-python-django.md) ·
**Date:** 2026-10-24

## Context

Two problems at once. ADR-0008 chose Vercel when the stack was Next.js; Django needs a long-running
process, so that choice lapsed with ADR-0010 and the project had no host. Separately, Bat-Orgil had already
built a working RAG chatbot as a Streamlit app in its own repository, and the team wants it in Hyntor rather
than rewritten.

## Decision

**Render**, defined by [`render.yaml`](../../render.yaml) as a Blueprint, with three parts:

| Service | What it is |
| --- | --- |
| `hyntor-web` | Django, served by gunicorn with whitenoise for static files. The public entry point. |
| `hyntor-tutor` | The Streamlit tutor. Reachable only with a signed hand-off token. |
| `hyntor-db` | PostgreSQL, used by Django. |

The Blueprint is in the repository, so the deployment is reviewed in pull requests instead of configured by
clicking around a dashboard. The only value set by hand is `GEMINI_API_KEY`.

### Sign-in across two services

Streamlit cannot read Django's session cookie. The services get different hostnames, and `onrender.com` is
on the Public Suffix List, so a browser refuses to share one cookie between them.

Instead Django mints a **short-lived signed token** ([`tutor_chat/handoff.py`](../../tutor_chat/handoff.py)):

```
Django: user signed in -> make_token(secret, user_id, email, name, ttl=60s)
        redirect to https://hyntor-tutor.../?t=<payload>.<hmac-sha256>
Streamlit: read_token(secret) -> identity kept in st.session_state, token cleared from the URL
```

Both services import the same file, so there is one implementation of the format rather than two that can
drift. It uses only the standard library, so the tutor does not need Django installed. Render generates the
shared secret once and gives it to both services, so it never appears in the repository.

The design fails closed: with no secret configured, the tutor refuses everyone rather than letting them in.

### Memories are scoped to their owner

The chatbot's memory store was global — one SQLite table with no user column — so any user could read, edit
and delete every other user's memories from the sidebar. Every row and every query now carries a
`user_key`, and updates and deletes match on **both** the row id and the user key, so a forged id still
cannot reach another person's row.

### What this changes elsewhere

- **0003 AI provider.** Still Gemini through `google-genai`, but called from the tutor service, not from
  Django. The models in use are `gemini-3.6-flash` for replies and `gemini-3.1-flash-lite` for routing and
  summarizing.
- **0004 Retrieval.** This ADR said keyword matching and no embeddings. The tutor uses `gemini-embedding-001`
  with cosine similarity for long-term memory, and an LLM router over filenames for the knowledge base.
  0004's reasoning still holds for *course materials*, which are not wired up yet; the exception is memory.
- **0010.** One language, but now two deployables. The cohesion argument in 0010 was about code nobody can
  explain, and both services are Python written by the team; still, M4 grades architectural cohesion, and
  two services with separate user handling is the weakest point in the current design.

## Alternatives

- **Port the chatbot into Django.** One service, no hand-off, no second user model. Rejected for now because
  the Streamlit app works today and M3 is twelve days away; it stays the better long-term answer.
- **Reverse-proxy Streamlit behind Django.** Keeps one hostname and one cookie, but Render has no shared
  proxy layer in front of two services, and Streamlit's websocket makes proxying fragile.
- **A shared cookie on a custom domain.** Would work with a domain we control, since the Public Suffix List
  problem is specific to `onrender.com`. Rejected as an extra dependency before a deadline.
- **Railway or Fly.io.** Comparable. Render was chosen for the Blueprint file and the free PostgreSQL tier.

## Consequences

- **The free tier sleeps.** Both services spin down when idle and take roughly a minute to wake. Plan for
  that in the demo: open both pages before presenting.
- **Render's free PostgreSQL expires after 30 days.** It must be recreated, or upgraded, before the M5
  demo on 10 December.
- **The tutor's memories do not survive a deploy.** The container filesystem is rebuilt each time and
  SQLite lives on it. Acceptable for the demo; moving memories into PostgreSQL is follow-up work.
- **A captured hand-off URL can be replayed within 60 seconds.** HTTPS protects it in transit and the short
  lifetime limits the rest. Single-use tokens would need server-side storage.
- **The tutor is not yet the Hyntor tutor.** It answers from a global knowledge base with general personas,
  not from a course's materials with hint tiers and citations. That remains TUT-3 and TUT-7.
