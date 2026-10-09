// tRPC client for the SAME shared API the web app uses.
// The AppRouter import is TYPE-ONLY: it's erased at compile time, so no
// server code is ever bundled into the app - only the type information
// that gives every api.* call end-to-end type safety.
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@coursemind/api";
import { getToken } from "./auth";

// Where the backend lives.
//   Local dev, iOS simulator / web:  http://localhost:3000
//   Local dev, Android emulator:     http://10.0.2.2:3000
//   Local dev, physical phone:       http://<your-PC's-LAN-IP>:3000
//   Production builds:               set EXPO_PUBLIC_API_URL in eas.json
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      transformer: superjson,
      async headers() {
        const token = await getToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
