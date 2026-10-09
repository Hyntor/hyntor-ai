// Browser-side tRPC client (used in "use client" components).
// Server components don't use this - they call the API in-process via
// lib/server-api.ts (no HTTP round-trip).
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@coursemind/api";

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
    }),
  ],
});

/** Human-readable message out of a tRPC/fetch error. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
