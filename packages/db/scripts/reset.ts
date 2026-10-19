// npm run db:reset - drop everything, re-apply the schema, clear stored files, seed. Destroys all data in
// DATABASE_URL and STORAGE_DIR; meant for local databases and the demo (ADM-1).
import fs from "node:fs";

import { createPrismaClient, loadRootEnv, resolveStorageDir } from "../src";
import { seed } from "../seed/seed";
import { applySchema } from "./prisma";

loadRootEnv();
applySchema("reset");

const storageDir = resolveStorageDir();
fs.rmSync(storageDir, { recursive: true, force: true });

const prisma = createPrismaClient();
try {
  await seed(prisma, { storageDir, password: process.env.SEED_PASSWORD || undefined });
  console.log("Database reset and seeded.");
} finally {
  await prisma.$disconnect();
}
