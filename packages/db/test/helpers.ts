import { Prisma, type PrismaClient } from "@prisma/client";

/** Deletes every row, children first, so each test starts from an empty database. */
export async function deleteAllRows(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.messageCitation.deleteMany(),
    prisma.tutorMessage.deleteMany(),
    prisma.tutorSession.deleteMany(),
    prisma.materialChunk.deleteMany(),
    prisma.material.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.course.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.university.deleteMany(),
  ]);
}

/** True when `error` is Prisma's unique-constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
