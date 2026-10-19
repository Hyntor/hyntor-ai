// npm run db:seed
import { createPrismaClient, loadRootEnv, resolveStorageDir } from "../src";
import { SEED_USERS, seed } from "./seed";

loadRootEnv();
const prisma = createPrismaClient();
try {
  await seed(prisma, { storageDir: resolveStorageDir(), password: process.env.SEED_PASSWORD || undefined });
  console.log(`Seeded. Sign in as ${SEED_USERS.map((u) => u.email).join(", ")}`);
} finally {
  await prisma.$disconnect();
}
