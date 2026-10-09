// Prisma client singleton.
// In Next.js dev mode the server hot-reloads constantly; without the
// global cache below, every reload would open a new database connection
// until SQLite/Postgres runs out. The cache keeps exactly one client alive.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
