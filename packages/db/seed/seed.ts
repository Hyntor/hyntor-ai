// Demo data for local development, the demo and ADM-1's reset (FND-6, #11).
// Idempotent (E2): every write is an upsert on a natural unique key with an empty update, so a second run
// creates nothing and changes nothing.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hash } from "@node-rs/argon2";
import type { CourseRole, FileKind, PlatformRole, PrismaClient } from "@prisma/client";

const FILES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "files");

export const DEFAULT_SEED_PASSWORD = "hyntor-demo-password";

export const SEED_UNIVERSITY = { name: "Demo University", emailDomain: "example.edu" };

export const SEED_USERS: { key: string; email: string; displayName: string; platformRole: PlatformRole }[] = [
  { key: "admin", email: "admin@example.edu", displayName: "Avery Admin", platformRole: "admin" },
  {
    key: "maintainer",
    email: "maintainer@example.edu",
    displayName: "Morgan Maintainer",
    platformRole: "learner",
  },
  { key: "learner1", email: "learner1@example.edu", displayName: "Lee Learner", platformRole: "learner" },
  { key: "learner2", email: "learner2@example.edu", displayName: "Riley Learner", platformRole: "learner" },
];

export const SEED_COURSE = { code: "CSCI 1010", title: "Introduction to Programming (Demo)" };

// Two terms, so the library shows a past term's materials to a current-term learner (G2).
export const SEED_ENROLLMENTS: { user: string; term: string; courseRole: CourseRole }[] = [
  { user: "maintainer", term: "2026-SP", courseRole: "maintainer" },
  { user: "maintainer", term: "2026-FA", courseRole: "maintainer" },
  { user: "learner1", term: "2026-SP", courseRole: "member" },
  { user: "learner2", term: "2026-FA", courseRole: "member" },
];

// Original notes written by the team for this demo, not course files (T9).
export const SEED_MATERIALS: { file: string; title: string; fileKind: FileKind; uploader: string }[] = [
  {
    file: "loops-and-iteration-notes.pdf",
    title: "Loops and Iteration Notes",
    fileKind: "pdf",
    uploader: "learner1",
  },
  { file: "big-o-cheat-sheet.docx", title: "Big-O Cheat Sheet", fileKind: "docx", uploader: "maintainer" },
  { file: "recursion-slides.pptx", title: "Recursion Slides", fileKind: "pptx", uploader: "maintainer" },
];

export type SeedOptions = {
  /** LocalFileStore root the material files are copied into (ADR-0005). */
  storageDir: string;
  /** Password for every seeded account. */
  password?: string;
};

export async function seed(prisma: PrismaClient, options: SeedOptions): Promise<void> {
  const university = await prisma.university.upsert({
    where: { emailDomain: SEED_UNIVERSITY.emailDomain },
    create: SEED_UNIVERSITY,
    update: {},
  });

  // @node-rs/argon2 defaults to Argon2id (ADR-0007). ACC-3 owns password hashing; switch to its helper then.
  const passwordHash = await hash(options.password ?? DEFAULT_SEED_PASSWORD);
  const userIds = new Map<string, string>();
  for (const { key, ...user } of SEED_USERS) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, universityId: university.id, passwordHash, emailVerifiedAt: new Date() },
      update: {},
    });
    userIds.set(key, row.id);
  }
  const userId = (key: string): string => {
    const id = userIds.get(key);
    if (!id) throw new Error(`Seed refers to unknown user "${key}"`);
    return id;
  };

  const course = await prisma.course.upsert({
    where: { universityId_code: { universityId: university.id, code: SEED_COURSE.code } },
    create: { ...SEED_COURSE, universityId: university.id },
    update: {},
  });

  for (const { user, term, courseRole } of SEED_ENROLLMENTS) {
    const key = { userId: userId(user), courseId: course.id, term };
    await prisma.enrollment.upsert({
      where: { userId_courseId_term: key },
      create: { ...key, courseRole },
      update: {},
    });
  }

  for (const material of SEED_MATERIALS) {
    const bytes = fs.readFileSync(path.join(FILES_DIR, material.file));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const storageKey = `materials/${course.id}/${sha256}.${material.fileKind}`;

    const target = path.join(options.storageDir, storageKey);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    }

    // Extraction (LIB-2) indexes pending materials; the seed only registers them.
    await prisma.material.upsert({
      where: { courseId_sha256: { courseId: course.id, sha256 } },
      create: {
        courseId: course.id,
        uploaderId: userId(material.uploader),
        title: material.title,
        fileKind: material.fileKind,
        storageKey,
        byteSize: bytes.length,
        sha256,
      },
      update: {},
    });
  }
}
