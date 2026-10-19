import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { seed, SEED_MATERIALS, SEED_USERS } from "../seed/seed";
import { createPrismaClient } from "../src";
import { deleteAllRows } from "./helpers";

const prisma = createPrismaClient();
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyntor-seed-"));

async function rowCounts() {
  return {
    universities: await prisma.university.count(),
    users: await prisma.user.count(),
    courses: await prisma.course.count(),
    enrollments: await prisma.enrollment.count(),
    materials: await prisma.material.count(),
  };
}

beforeEach(async () => {
  await deleteAllRows(prisma);
  fs.rmSync(storageDir, { recursive: true, force: true });
});
afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

describe("seed", () => {
  it("creates the demo data", async () => {
    await seed(prisma, { storageDir });

    expect(await rowCounts()).toEqual({
      universities: 1,
      users: 4,
      courses: 1,
      enrollments: 4,
      materials: 3,
    });
    const terms = await prisma.enrollment.findMany({ distinct: ["term"], select: { term: true } });
    expect(terms.map((t) => t.term).sort()).toEqual(["2026-FA", "2026-SP"]);
  });

  it("is idempotent: a second run leaves identical row counts (E2)", async () => {
    await seed(prisma, { storageDir });
    const first = await rowCounts();

    await seed(prisma, { storageDir });

    expect(await rowCounts()).toEqual(first);
  });

  it("stores Argon2id hashes, never the password", async () => {
    await seed(prisma, { storageDir, password: "test-password" });

    const users = await prisma.user.findMany({ select: { passwordHash: true } });
    expect(users).toHaveLength(SEED_USERS.length);
    for (const { passwordHash } of users) {
      expect(passwordHash).toMatch(/^\$argon2id\$/);
      expect(passwordHash).not.toContain("test-password");
    }
  });

  it("copies each material to its storage key", async () => {
    await seed(prisma, { storageDir });

    const materials = await prisma.material.findMany();
    expect(materials).toHaveLength(SEED_MATERIALS.length);
    for (const material of materials) {
      expect(fs.statSync(path.join(storageDir, material.storageKey)).size).toBe(material.byteSize);
    }
  });
});
