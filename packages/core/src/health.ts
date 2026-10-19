import { z } from "zod";

export const healthOutput = z.object({
  status: z.literal("ok"),
  serverTime: z.date(),
});

export type HealthOutput = z.infer<typeof healthOutput>;
