// The single tRPC HTTP endpoint - consumed by the web client AND the
// Expo mobile app (mobile authenticates with "Authorization: Bearer <jwt>").
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@coursemind/api";
import { auth } from "@/auth";

const handler = async (req: Request) => {
  const session = await auth();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext({
        sessionUserId: session?.user?.id ?? null,
        authorizationHeader: req.headers.get("authorization"),
      }),
    onError({ error, path }) {
      console.error(`[tRPC] ${path ?? "<unknown>"}:`, error.message);
    },
  });
};

export { handler as GET, handler as POST };
