import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  buildFlashcardGenerationPrompt,
  extractJson,
  FlashcardDraftsSchema,
  previewIntervals,
  REVIEW_RATINGS,
  reviewCard,
} from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured } from "../ai";

function fallbackFlashcards(text: string, count: number) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 60 && s.length <= 260);

  const picked = cleaned.slice(0, count);
  if (picked.length === 0) {
    return [
      {
        front: "What is the main idea from this material?",
        back: text.replace(/\s+/g, " ").trim().slice(0, 240) || "Review the uploaded material.",
      },
    ];
  }

  return picked.map((sentence, index) => ({
    front: `Explain this idea from the material in your own words: #${index + 1}`,
    back: sentence,
  }));
}

export const flashcardRouter = router({
  due: protectedProcedure
    .input(z.object({ courseId: z.string(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const cards = await ctx.prisma.flashcard.findMany({
        where: {
          userId: ctx.userId,
          courseId: input.courseId,
          nextReviewAt: { lte: new Date() },
        },
        orderBy: { nextReviewAt: "asc" },
        take: input.limit,
      });
      return cards.map((card) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        nextReviewAt: card.nextReviewAt,
        easeFactor: card.easeFactor,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        previews: previewIntervals({
          easeFactor: card.easeFactor,
          intervalDays: card.intervalDays,
          repetitions: card.repetitions,
        }),
      }));
    }),

  generate: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        materialId: z.string(),
        cardCount: z.number().int().min(4).max(30).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const material = await ctx.prisma.material.findUniqueOrThrow({
        where: { id: input.materialId },
        select: { id: true, courseId: true, title: true, extractedText: true },
      });
      if (material.courseId !== input.courseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That material is not in this course." });
      }
      if (!material.extractedText.trim()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This material has no extracted text to turn into flashcards.",
        });
      }

      let drafts = fallbackFlashcards(material.extractedText, input.cardCount);
      if (isAiConfigured()) {
        const raw = await askClaude({
          system: "You create high-quality university flashcards. Respond with ONLY valid JSON.",
          messages: [
            {
              role: "user",
              content: buildFlashcardGenerationPrompt({
                materialTitle: material.title,
                materialText: material.extractedText.slice(0, 48_000),
                cardCount: input.cardCount,
              }),
            },
          ],
          maxTokens: 4096,
        });
        const parsed = FlashcardDraftsSchema.safeParse(extractJson(raw));
        if (parsed.success && parsed.data.length > 0) {
          drafts = parsed.data.slice(0, input.cardCount);
        }
      }

      await ctx.prisma.flashcard.createMany({
        data: drafts.map((card) => ({
          userId: ctx.userId,
          courseId: input.courseId,
          front: card.front,
          back: card.back,
        })),
      });

      return { count: drafts.length };
    }),

  review: protectedProcedure
    .input(z.object({ flashcardId: z.string(), rating: z.enum(REVIEW_RATINGS) }))
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.prisma.flashcard.findUniqueOrThrow({
        where: { id: input.flashcardId },
      });
      if (card.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      await requireEnrollment(ctx.userId, card.courseId);

      const next = reviewCard(
        {
          easeFactor: card.easeFactor,
          intervalDays: card.intervalDays,
          repetitions: card.repetitions,
        },
        input.rating
      );

      const updated = await ctx.prisma.flashcard.update({
        where: { id: card.id },
        data: next,
      });

      return {
        id: updated.id,
        nextReviewAt: updated.nextReviewAt,
        intervalDays: updated.intervalDays,
        repetitions: updated.repetitions,
      };
    }),
});
