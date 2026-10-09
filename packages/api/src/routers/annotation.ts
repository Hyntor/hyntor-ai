// Phase 4: inline annotations - shared, class-visible notes on a material.
// Anyone enrolled in the material's course can read and add notes; an
// annotation can be anchored to a quoted snippet of the material text
// (`quote`) or stand alone as a general note. Flat, not threaded - kept
// simple and student-native. You can only delete your own notes.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEnrollment } from "../trpc";

export const annotationRouter = router({
  listByMaterial: protectedProcedure
    .input(z.object({ materialId: z.string() }))
    .query(async ({ ctx, input }) => {
      const material = await ctx.prisma.material.findUniqueOrThrow({
        where: { id: input.materialId },
        select: { courseId: true },
      });
      await requireEnrollment(ctx.userId, material.courseId);
      const annotations = await ctx.prisma.annotation.findMany({
        where: { materialId: input.materialId },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true } } },
      });
      return annotations.map((a) => ({
        id: a.id,
        quote: a.quote,
        body: a.body,
        authorName: a.author.name,
        mine: a.author.id === ctx.userId,
        createdAt: a.createdAt,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        materialId: z.string(),
        body: z.string().min(1).max(4000),
        quote: z.string().max(1000).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const material = await ctx.prisma.material.findUniqueOrThrow({
        where: { id: input.materialId },
        select: { courseId: true },
      });
      await requireEnrollment(ctx.userId, material.courseId);
      const annotation = await ctx.prisma.annotation.create({
        data: {
          materialId: input.materialId,
          authorId: ctx.userId,
          body: input.body.trim(),
          quote: input.quote.trim(),
        },
      });
      return { id: annotation.id };
    }),

  delete: protectedProcedure
    .input(z.object({ annotationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const annotation = await ctx.prisma.annotation.findUniqueOrThrow({
        where: { id: input.annotationId },
        select: { authorId: true },
      });
      if (annotation.authorId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own notes.",
        });
      }
      await ctx.prisma.annotation.delete({ where: { id: input.annotationId } });
      return { ok: true };
    }),
});
