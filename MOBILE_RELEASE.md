# Shipping the Hyntor mobile app to the App Store & Google Play

This is the complete checklist. Steps marked **** require accounts, payments, or legal
agreements that only you can do. Everything else is a command you run.

## 0. Prerequisites (one-time)

1. ** - Expo account** (free): https://expo.dev/signup
2. ** - Apple Developer Program** ($99/year): https://developer.apple.com/programs/enroll/
   - requires an Apple ID with two-factor auth; enrollment approval can take 1-2 days.
3. ** - Google Play Developer account** ($25 one-time): https://play.google.com/console/signup
   - identity verification can take a few days.
4. Install the EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```

## 1. Link the project to EAS (one-time)

```bash
cd apps/mobile
eas init        # creates an EAS project and writes its ID into app.json
```
This replaces the `REPLACE_WITH_YOUR_EAS_PROJECT_ID` placeholder in `app.json`.

## 2. Deploy the backend first

The store builds need a **public HTTPS API** - your laptop's localhost won't work.
Deploy `apps/web` (Vercel is the easiest for Next.js; any Node host works):
1. Push this repo to GitHub (already done) -> import the repo in https://vercel.com
   - Set the "Root Directory" to `apps/web`
   - Add env vars: `DATABASE_URL` (a hosted Postgres - e.g. Neon free tier),
     `AUTH_SECRET`, `ANTHROPIC_API_KEY`
   - Before first deploy: switch Prisma to Postgres (one line - see README) and run
     `npm run db:migrate` against the hosted database.
2. Put the deployed URL into `apps/mobile/eas.json` - replace **both** occurrences of
   `https://YOUR-DEPLOYED-WEB-APP.example.com` with your real URL.

## 3. Build the binaries

```bash
cd apps/mobile

# Android (.aab for the Play Store)
eas build --platform android --profile production

# iOS (.ipa for the App Store) - works from Windows! EAS builds in the cloud.
eas build --platform ios --profile production
```
- ****: the first iOS build asks you to log in with your Apple Developer account so
  EAS can create signing certificates and provisioning profiles for you. Let EAS manage
  credentials (the default) - it's by far the least painful option.
- Android signing keys are generated and stored by EAS automatically.

## 4. Store listings

- ** - App Store Connect** (https://appstoreconnect.apple.com): create the app record
  (bundle ID `com.Hyntor.app`), fill in name, description, screenshots (take them from
  a simulator or device), privacy policy URL, and the App Privacy questionnaire.
- ** - Play Console** (https://play.google.com/console): same - app record (package
  `com.Hyntor.app`), store listing, content rating questionnaire, data-safety form.
- App review tips: Apple rejects "thin webview wrappers" (guideline 4.2) - Hyntor is a
  real native app, so describe the native features (tutor chat, quizzes, course library).
  Both stores will want a demo login for review: give them `alex@demo.edu` / `Hyntor`
  on your deployed backend.

## 5. Submit

```bash
eas submit --platform android --latest
eas submit --platform ios --latest
```
- ****: accept store agreements in each console the first time, then release from
  the console (start with "internal testing" on Play / TestFlight on iOS - sanity-check
  the production build before public release).

## 6. Updating the app later

- JS-only changes can ship instantly with `eas update` (over-the-air, no review).
- Native/dependency changes need a new `eas build` + `eas submit` + store review.

## Cost summary

| Item | Cost |
|---|---|
| Apple Developer Program | $99 / year |
| Google Play Developer | $25 once |
| EAS Build | Free tier covers low volume; paid plans add concurrency |
| Backend hosting | Vercel hobby free; hosted Postgres (Neon) free tier |
