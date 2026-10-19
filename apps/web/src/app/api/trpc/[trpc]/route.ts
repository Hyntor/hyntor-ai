import { appRouter, createContext } from "@hyntor/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers }),
  });
}

export { handler as GET, handler as POST };
