import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "../src";
import { deleteAllRows, isUniqueViolation } from "./helpers";

const prisma = createPrismaClient();

async function seedCourses() {
  const university = await prisma.university.create({ data: { name: "Test U", emailDomain: "test.edu" } });
  const user = await prisma.user.create({
    data: { universityId: university.id, email: "a@test.edu", displayName: "A", passwordHash: "x" },
  });
  const [courseA, courseB] = await Promise.all(
    ["TEST 101", "TEST 102"].map((code) =>
      prisma.course.create({ data: { universityId: university.id, code, title: code } }),
    ),
  );
  return { user, courseA: courseA!, courseB: courseB! };
}

function materialData(courseId: string, uploaderId: string, storageKey: string) {
  return {
    courseId,
    uploaderId,
    storageKey,
    title: "Notes",
    fileKind: "pdf" as const,
    byteSize: 10,
    sha256: "a".repeat(64),
  };
}

beforeEach(() => deleteAllRows(prisma));
afterAll(() => prisma.$disconnect());

describe("Enrollment (userId, courseId, term)", () => {
  it("rejects a second enrollment in the same course and term", async () => {
    const { user, courseA } = await seedCourses();
    const enrollment = { userId: user.id, courseId: courseA.id, term: "2026-FA" };
    await prisma.enrollment.create({ data: enrollment });

    const duplicate = prisma.enrollment.create({ data: enrollment });

    await expect(duplicate).rejects.toSatisfy(isUniqueViolation);
  });

  it("allows the same user and course in another term", async () => {
    const { user, courseA } = await seedCourses();
    await prisma.enrollment.create({ data: { userId: user.id, courseId: courseA.id, term: "2026-SP" } });

    await prisma.enrollment.create({ data: { userId: user.id, courseId: courseA.id, term: "2026-FA" } });

    expect(await prisma.enrollment.count()).toBe(2);
  });
});

describe("Material (courseId, sha256)", () => {
  it("rejects the same file twice in one course", async () => {
    const { user, courseA } = await seedCourses();
    await prisma.material.create({ data: materialData(courseA.id, user.id, "k1") });

    const duplicate = prisma.material.create({ data: materialData(courseA.id, user.id, "k2") });

    await expect(duplicate).rejects.toSatisfy(isUniqueViolation);
  });

  it("allows the same file in another course", async () => {
    const { user, courseA, courseB } = await seedCourses();
    await prisma.material.create({ data: materialData(courseA.id, user.id, "k1") });

    await prisma.material.create({ data: materialData(courseB.id, user.id, "k2") });

    expect(await prisma.material.count()).toBe(2);
  });
});

describe("TutorMessage (tutorSessionId, ordinal)", () => {
  it("rejects two messages with the same ordinal in one session", async () => {
    const { user, courseA } = await seedCourses();
    const session = await prisma.tutorSession.create({
      data: { courseId: courseA.id, studentId: user.id, mode: "concept" },
    });
    const message = { tutorSessionId: session.id, ordinal: 0, authorRole: "student" as const, body: "Hi" };
    await prisma.tutorMessage.create({ data: message });

    const duplicate = prisma.tutorMessage.create({ data: message });

    await expect(duplicate).rejects.toSatisfy(isUniqueViolation);
  });
});
