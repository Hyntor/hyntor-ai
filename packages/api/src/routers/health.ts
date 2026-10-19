import { healthOutput } from "@hyntor/core";

import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  check: publicProcedure.output(healthOutput).query(() => ({
    status: "ok" as const,
    serverTime: new Date(),
  })),
});
