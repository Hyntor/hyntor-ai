import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// FND-7 (#12) resolves the session cookie into a user here.
export type Context = {
  headers: Headers;
};

export function createContext(opts: { headers: Headers }): Context {
  return { headers: opts.headers };
}

const t = initTRPC.context<Context>().create({
  // superjson keeps Date values intact across the wire.
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
