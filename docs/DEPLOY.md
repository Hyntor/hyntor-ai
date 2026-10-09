# Deploying Hyntor to the web (Vercel + Neon)

This is a step-by-step, beginner-friendly guide to putting Hyntor on a real,
public URL. Hosting is **Vercel** (it auto-deploys from your GitHub repo) and
the database is **Neon** (serverless PostgreSQL). Both have free tiers that are
plenty to launch.

**Time:** ~15 minutes. **Cost:** $0 on the free tiers.

> Why Postgres? Local development uses a SQLite file (zero install). A hosted
> site can't use a local file, so production runs on PostgreSQL. You do **not**
> edit the schema by hand — the build generates the Postgres version
> automatically from `packages/db/prisma/schema.prisma`.

---

## Before you start

- Your code is already on GitHub at `BatOrgil7/coursemind`. Make sure your
  latest changes are pushed (`git push`).
- You'll create two free accounts: **Neon** and **Vercel**. Sign in to both
  with your GitHub account to keep things simple.

---

## Step 1 — Create the database (Neon)

1. Go to https://neon.tech and sign up (use "Continue with GitHub").
2. Click **Create project**. Name it `hyntor`, pick a region near you, and
   create it.
3. On the project dashboard, find **Connection string** and copy it. It looks
   like:
   ```
   postgresql://neondb_owner:XXXX@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this tab open — you'll paste this string into Vercel in Step 2.

That's it for Neon. The tables get created automatically on your first deploy
(the build runs `prisma db push` against this database).

---

## Step 2 — Create the website (Vercel)

1. Go to https://vercel.com and sign up with GitHub.
2. Click **Add New… → Project**, then **Import** your `coursemind` repository.
3. **Configure the project** (most of this is auto-filled by `vercel.json`, but
   verify):
   - **Root Directory:** leave as the repository root (`.`). Do **not** set it
     to `apps/web` — the build needs the whole monorepo.
   - **Framework Preset:** Next.js (auto-detected).
   - **Build/Install/Output commands:** already set by `vercel.json` — no need
     to change them.
4. Expand **Environment Variables** and add these:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string you copied in Step 1 |
   | `AUTH_SECRET` | a long random string (see below) |
   | `AUTH_TRUST_HOST` | `true` |
   | `AUTH_GOOGLE_ID` | Google OAuth web client ID |
   | `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

   To generate a strong `AUTH_SECRET`, run this locally and copy the output:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   > Keep `AUTH_SECRET` stable. If you change it later, everyone gets logged out.

5. Click **Deploy**. The first build takes a couple of minutes (it installs
   dependencies, creates the database tables in Neon, and builds the app).

When it finishes you'll get a public URL like `https://hyntor.vercel.app`.

---

## Step 3 - Create Google sign-in credentials

1. Go to https://console.cloud.google.com/apis/credentials.
2. Create or select a project, then configure the **OAuth consent screen**.
   Use `Hyntor` as the app name and add your deployed domain as an authorized
   domain, for example `hyntor.vercel.app` or your custom domain.
3. Go to **Credentials -> Create credentials -> OAuth client ID**.
4. Choose **Web application**.
5. Add your production URL under **Authorized JavaScript origins**:
   ```
   https://your-domain.com
   ```
6. Add this under **Authorized redirect URIs**:
   ```
   https://your-domain.com/api/auth/callback/google
   ```
7. Copy the generated client ID and client secret into Vercel as
   `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, then redeploy.

For local testing, add these too:
```
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

---

## Step 4 - Try it

1. Open your new URL and click **Create an account**.
2. Sign up with a school Google account or university email, create a course, and add a material using
   **Paste text** (see the file-upload note below).
3. You're live.

> **Demo accounts don't exist in production.** `alex@demo.edu` and friends are
> local-only seed data with a publicly-known password — they're intentionally
> not created on the real site. Real users sign up for real accounts.

---

## Turning on AI features (optional, later)

The tutor chat, quiz generation, and AI grading need an Anthropic API key.
Without one, everything else works and AI features show a friendly "not
configured" message.

To enable them:
1. Get a key at https://console.anthropic.com/settings/keys (billed per use).
2. In Vercel: **Project → Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY` = your key.
3. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy) so the new variable takes
   effect.

---

## Email verification codes (recommended)

Email/password signups must confirm a 6-digit code. To email those codes for
real, add a free **Resend** account:

1. Sign up at https://resend.com and create an **API key**.
2. In Vercel add `RESEND_API_KEY` = your key (Production + Preview), then redeploy.
3. To email *anyone* (not just your own address), verify a sending domain in
   Resend and set `EMAIL_FROM="Hyntor <no-reply@yourdomain.com>"`. Until you do,
   Resend only delivers to the address you signed up with.

Without `RESEND_API_KEY`, signup still works — the code is shown on the verify
screen in a clearly-marked "dev mode" banner (fine for testing, not for a real
public launch). Google sign-in needs no code (Google already verifies the email).

> Personal emails (Gmail, etc.) are allowed for both signup and Google sign-in.
> School-email users are grouped with their campus; personal-email users get
> their own private study space.

---

## File uploads (one click to enable)

By default the hosted site has **no place to keep uploaded files** (serverless
filesystems are temporary), so the upload page steers students to **Paste
text** — which is exactly what the AI tutor reads, so nothing is lost.

To enable real file uploads (PDFs, slides, docs):

1. In Vercel: **Project → Storage → Create Database → Blob** and connect it to
   the project. Vercel adds the `BLOB_READ_WRITE_TOKEN` variable automatically.
2. **Redeploy.** That's it — uploads now go to Vercel Blob, text is extracted
   as usual, and each material page gets an **Open original file** link.

Blob has a free tier (a few GB) and needs no code changes — the app detects
the token and switches storage automatically. Local development keeps writing
to `apps/web/uploads/` either way.

---

## Updating the live site

Every time you `git push` to the `main` branch, Vercel automatically rebuilds
and redeploys. There's nothing else to do.

If you change the database schema (`schema.prisma`), the next deploy applies it
to Neon automatically (`prisma db push` runs in the build). For a destructive
change on a database that already has data, the build will stop safely rather
than drop data — push such changes deliberately.

---

## Custom domain (optional)

In **Vercel → Project → Settings → Domains**, add a domain you own and follow
the DNS instructions. Hyntor will serve from it automatically.

---

## Troubleshooting

- **Build fails on "Environment variable not found: DATABASE_URL".** You didn't
  add `DATABASE_URL` in Vercel's env vars, or it's set for the wrong
  environment. Add it for Production (and Preview) and redeploy.
- **Sign-in fails / "UntrustedHost".** Make sure `AUTH_TRUST_HOST=true` is set.
  (The code also sets `trustHost`, so this is belt-and-suspenders.)
- **"Can't reach database server".** Double-check the Neon connection string,
  including the `?sslmode=require` at the end.
- **AI features show a setup message.** That's expected until you add
  `ANTHROPIC_API_KEY` (see above).

---

## What's happening under the hood (for the curious)

- `vercel.json` points Vercel at the monorepo and runs `npm run vercel-build`.
- `vercel-build` (root `package.json`) does: generate the Postgres schema from
  `schema.prisma` (`scripts/gen-prod-schema.mjs`) → generate the Prisma client
  for Postgres → `prisma db push` to create/update tables in Neon → `next build`.
- Local development is untouched: it still uses SQLite via the unchanged
  `schema.prisma`. The Postgres schema (`schema.prod.prisma`) is generated and
  gitignored — `schema.prisma` stays the single source of truth.
