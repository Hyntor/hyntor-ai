import { PrismaClient } from "@prisma/client";

import { resolveDatabaseUrl } from "./env";

// One client per process; Next.js dev reloads modules, so the instance is kept on globalThis there.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(url = resolveDatabaseUrl()): PrismaClient {
  return new PrismaClient(url ? { datasourceUrl: url } : undefined);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export { findRepoRoot, isSqliteUrl, loadRootEnv, resolveDatabaseUrl } from "./env";
