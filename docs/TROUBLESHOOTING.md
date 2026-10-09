# Troubleshooting Hyntor

**Start here when something breaks.** This guide is organized by symptom. Each entry says
what's probably wrong, how to confirm it, and how to fix it.

---

## Golden rules (fixes 80% of problems)

1. **Read the terminal where `npm run dev` is running.** The real error is almost always
   printed there, not in the browser.
2. **Restart the dev server** after changing any `.env` file or anything in `packages/`:
   press `Ctrl+C`, then `npm run dev`.
3. **Re-install if dependencies look weird:** delete `node_modules` + run `npm install` at
   the repo root (and separately inside `apps/mobile` for the mobile app).
4. **The database is just a file:** `packages/db/prisma/dev.db`. Worst case, delete it and
   run `npm run db:setup` for a fresh, seeded database. (You lose dev data - that's fine.)

---

## Web app

### "Port 3000 is already in use"
Something else (or a stuck old server) holds the port.
```powershell
# Find and kill whatever is on port 3000:
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
npm run dev
```

### Login does nothing / immediately says "Invalid email or password"
- Did you run `npm run db:setup`? The demo users come from the seed.
- Check the password is exactly `coursemind` (all lowercase).
- If you changed `AUTH_SECRET` in `apps/web/.env.local`, every session is invalidated  -
  that's normal, just log in again. If `AUTH_SECRET` is missing entirely, the server
  terminal will show a NextAuth "secret" error -> run `npm run setup`.

### Every page redirects to /login even after logging in
Cookies are tied to the URL. Use `http://localhost:3000` exactly - not `127.0.0.1`,
not a different port.

### "AI features aren't configured yet"
That's the friendly message meaning `ANTHROPIC_API_KEY` is empty.
1. Add the key in `apps/web/.env.local`
2. Restart the dev server. (Env files are only read at startup.)

### AI calls fail with 401 / "authentication_error"
Your API key is wrong or revoked. Check it at https://console.anthropic.com/settings/keys  -
it must start with `sk-ant-`. No quotes problems? The line should look like:
`ANTHROPIC_API_KEY="sk-ant-api03-..."`

### AI calls fail with 429 / "rate limit"
You're out of API credits or hitting rate limits. Check your usage at
https://console.anthropic.com - quiz generation uses the most tokens of any feature.

### Quiz generation fails with "unexpected quiz format"
The model occasionally returns malformed JSON. It's safe to just click **Generate quiz**
again. If it fails repeatedly on one material, that material's text may be too messy  -
open the material page and look at what was extracted.

### Upload says "No text could be extracted"
Usually a **scanned/image-only PDF** (photos of pages, no real text). The AI can't read
those yet. Fixes: use an OCR'd copy, export the source document to PDF again, or paste
the text via **Upload material -> Paste text**.

### `prisma generate` fails with EPERM on Windows
The query engine DLL is locked by a running dev server. Stop `npm run dev`, run the
Prisma command, then start the server again.

### "Table ... does not exist" or Prisma schema drift errors
The database file is older than the schema. Run:
```bash
npm run db:migrate      # apply pending migrations
# or nuke-and-rebuild (loses dev data):
# delete packages/db/prisma/dev.db, then: npm run db:setup
```

### Changed something in packages/core or packages/api and nothing happened
Next.js compiles those packages (`transpilePackages`), and usually hot-reloads them.
If it doesn't pick a change up: restart the dev server. If it STILL doesn't: delete
`apps/web/.next` and restart.

---

## Mobile app

### "Network request failed" on every screen
The app can't reach the API. Two things must be true:
1. The web server is running (`npm run dev` at the repo root).
2. The app uses the right URL **for where it's running** (see table in README):
   - Android emulator -> `http://10.0.2.2:3000` (NOT localhost - that's the emulator itself)
   - Physical phone -> your PC's LAN IP (`ipconfig` -> "IPv4 Address"), phone on the same Wi-Fi,
     and Windows Firewall allowing Node on private networks.
   ```powershell
   $env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"; npx expo start
   ```

### tRPC types are all `never` in apps/mobile
The `@trpc/client` version in `apps/mobile` must EXACTLY match the `@trpc/server` version
in the root `node_modules` (check both `package.json`s). Mismatched copies make TypeScript
reject the router type. Fix:
```bash
cd apps/mobile
npm install @trpc/client@<root-version> @trpc/server@<root-version> --save-exact
```

### Expo "Unable to resolve module ..."
```bash
cd apps/mobile
npx expo start --clear     # clears Metro's cache
```
If that fails: delete `apps/mobile/node_modules`, run `npm install` there again.

### Login works on web but not mobile
Mobile auth uses a different code path (JWT via `user.mobileLogin`, not NextAuth cookies)
but the SAME `AUTH_SECRET`. If you regenerate `AUTH_SECRET`, stored mobile tokens become
invalid - sign out and back in on the device.

---

## Database inspection (when you want to SEE the data)

```bash
npm run db:studio
```
Opens Prisma Studio at http://localhost:5555 - a GUI to browse and edit every table.
Great for checking "did my upload actually store extracted text?" (Material table,
`extractedText` column) or "what tier did my tutor session reach?" (TutorSession).

---

## Where things live (so you know what file to look at)

| Symptom area | Look in |
|---|---|
| Tutor behavior / hint tiers / prompts | `packages/core/src/prompts.ts` |
| Tier escalation, grounding, session storage | `packages/api/src/routers/tutor.ts` |
| Quiz generation/grading | `packages/api/src/routers/quiz.ts` |
| File text extraction | `packages/api/src/extract.ts` |
| Signup / university verification / mobile JWT | `packages/api/src/auth.ts` |
| Web login session plumbing | `apps/web/auth.ts` |
| Upload endpoint | `apps/web/app/api/upload/route.ts` |
| XP / streak rules | `packages/api/src/activity.ts` + `packages/core/src/constants.ts` |
| Database shape | `packages/db/prisma/schema.prisma` |
| Web page UI | `apps/web/app/(app)/...` (folder names match URLs) |
| Mobile screen UI | `apps/mobile/src/app/...` (file names match routes) |

## Still stuck?

Run these and read the output carefully - they catch most breakage:
```bash
npm run typecheck     # type errors across all packages
npm run db:setup      # repairs a missing/empty database
```
And remember the dev-server terminal is the single best source of truth.
