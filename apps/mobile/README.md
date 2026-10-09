# Hyntor Mobile (Expo)

The native iOS/Android app. It consumes the exact same tRPC API as the web app.

```bash
npm install        # run here, inside apps/mobile (NOT covered by the root install)
npx expo start
```

- Press `a` (Android emulator), `i` (iOS simulator, Mac only), or scan the QR with Expo Go.
- The backend must be running: `npm run dev` at the repo root.
- Android emulator? Point at the host machine:
  `$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"; npx expo start`

Key files:
- `src/lib/api.ts` - typed tRPC client (+ where the API URL is configured)
- `src/lib/auth.ts` - JWT storage in the device secure enclave
- `src/app/` - screens (expo-router: file path = route)
- `src/lib/theme.ts` - design tokens mirroring the web palette

Store release: see [../../MOBILE_RELEASE.md](../../MOBILE_RELEASE.md).
Troubleshooting: see [../../docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) -> "Mobile app".
