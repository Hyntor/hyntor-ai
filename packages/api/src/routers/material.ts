import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { MATERIAL_TYPES, XP_RULES } from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { recordActivity } from "../activity";
import { prisma } from "@coursemind/db";
import { extractTextFromFile } from "../extract";

export const materialRouter = router({
  get: protectedProcedure
    .input(z.object({ materialId: z.string() }))
    .query(async ({ ctx, input }) => {
      const material = await ctx.prisma.material.findUniqueOrThrow({
        where: { id: input.materialId },
        include: { uploader: { select: { name: true } }, course: { select: { id: true, code: true, title: true } } },
      });
      await requireEnrollment(ctx.userId, material.courseId);
      const myUpvote = await ctx.prisma.materialUpvote.findUnique({
        where: { materialId_userId: { materialId: material.id, userId: ctx.userId } },
        select: { id: true },
      });
      return {
        id: material.id,
        title: material.title,
        type: material.type,
        fileUrl: material.fileUrl,
        extractedText: material.extractedText,
        upvoteCount: material.upvoteCount,
        upvotedByMe: myUpvote !== null,
        isMine: material.uploaderId === ctx.userId,
        uploaderName: material.uploader.name,
        course: material.course,
        createdAt: material.createdAt,
      };
    }),

  /** Paste-in notes/syllabus as text - no file needed. */
  createFromText: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        title: z.string().min(1).max(200),
        type: z.enum(MATERIAL_TYPES).default("NOTES"),
        text: z.string().min(1).max(400_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const material = await ctx.prisma.material.create({
        data: {
          courseId: input.courseId,
          uploaderId: ctx.userId,
          title: input.title,
          type: input.type,
          extractedText: input.text,
        },
      });
      await recordActivity(ctx.userId, "MATERIAL_UPLOADED");
      return { id: material.id };
    }),

  /**
   * Toggle the current user's upvote on a material. Upvotes are the
   * class's quality signal - they reorder the shared library and the
   * tutor's grounding (best-upvoted first). Keeping `upvoteCount` in sync
   * with the join table inside a transaction makes it the source of truth.
   * The first time a classmate upvotes, the UPLOADER earns XP (good
   * sharing rewarded) - but not their streak, since it's a passive event.
   */
  upvote: protectedProcedure
    .input(z.object({ materialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const material = await ctx.prisma.material.findUniqueOrThrow({
        where: { id: input.materialId },
        select: { id: true, courseId: true, uploaderId: true },
      });
      await requireEnrollment(ctx.userId, material.courseId);
      if (material.uploaderId === ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't upvote your own material - but thanks for sharing it with the class!",
        });
      }

      const existing = await ctx.prisma.materialUpvote.findUnique({
        where: { materialId_userId: { materialId: material.id, userId: ctx.userId } },
        select: { id: true },
      });
      const upvoted = !existing;

      const upvoteCount = await ctx.prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.materialUpvote.delete({ where: { id: existing.id } });
        } else {
          await tx.materialUpvote.create({
            data: { materialId: material.id, userId: ctx.userId },
          });
          // Reward the uploader for sharing something the class values.
          // XP only (no streak): the uploader didn't act today.
          await tx.user.update({
            where: { id: material.uploaderId },
            data: { xp: { increment: XP_RULES.MATERIAL_UPVOTED } },
          });
          await tx.activityLog.create({
            data: {
              userId: material.uploaderId,
              type: "MATERIAL_UPVOTED",
              points: XP_RULES.MATERIAL_UPVOTED,
            },
          });
        }
        const count = await tx.materialUpvote.count({ where: { materialId: material.id } });
        await tx.material.update({
          where: { id: material.id },
          data: { upvoteCount: count },
        });
        return count;
      });

      return { upvoted, upvoteCount };
    }),
});

/**
 * File-upload path. Multipart uploads don't flow through tRPC; the
 * /api/upload route handler (web) receives the file and calls this  -
 * the business logic stays in the shared API package per the spec.
 * Mobile hits the same /api/upload endpoint with its Bearer token.
 */
export async function createMaterialFromFile(opts: {
  userId: string;
  courseId: string;
  title: string;
  filename: string;
  buffer: Buffer;
  fileUrl: string;
}) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: opts.userId, courseId: opts.courseId } },
  });
  if (!enrollment) throw new Error("You need to join this course before uploading materials.");

  const { text, materialType, warning } = await extractTextFromFile(opts.buffer, opts.filename);
  const material = await prisma.material.create({
    data: {
      courseId: opts.courseId,
      uploaderId: opts.userId,
      title: opts.title || opts.filename,
      type: materialType,
      fileUrl: opts.fileUrl,
      extractedText: text,
    },
  });
  await recordActivity(opts.userId, "MATERIAL_UPLOADED");
  return { id: material.id, warning, extractedChars: text.length };
}
