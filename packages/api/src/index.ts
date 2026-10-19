import { healthRouter } from "./routers/health";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
export { createContext, type Context } from "./trpc";
