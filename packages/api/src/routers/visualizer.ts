// Concept visualizer (Phase 4, final feature). One procedure: turn a
// concept the student names into a concept-map graph, grounded in the
// course's shared materials. With no API key (or unparseable AI output)
// it degrades to the deterministic offline study map from core.
import { z } from "zod";
import {
  ConceptMapSchema,
  buildConceptMapPrompt,
  buildFallbackConceptMap,
  extractJson,
  normalizeConceptMap,
  type ConceptMap,
} from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured } from "../ai";
import { gatherGrounding } from "../grounding";

export const visualizerRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        concept: z.string().trim().min(2).max(120),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        select: { title: true },
      });

      const fallback = async (notice: string | null) => {
        const materials = await ctx.prisma.material.findMany({
          where: { courseId: input.courseId },
          orderBy: [{ upvoteCount: "desc" }, { createdAt: "desc" }],
          select: { title: true },
          take: 8,
        });
        return {
          aiGenerated: false as const,
          notice,
          map: buildFallbackConceptMap({
            concept: input.concept,
            materialTitles: materials.map((m) => m.title),
          }),
        };
      };

      if (!isAiConfigured()) {
        // The map itself explains how to unlock the AI version.
        return fallback(null);
      }

      const grounding = await gatherGrounding(ctx.prisma, input.courseId);
      let map: ConceptMap;
      try {
        const raw = await askClaude({
          system: buildConceptMapPrompt({
            concept: input.concept,
            courseTitle: course.title,
            materials: grounding,
          }),
          messages: [{ role: "user", content: `Build the concept map for: ${input.concept}` }],
        });
        map = normalizeConceptMap(ConceptMapSchema.parse(extractJson(raw)));
      } catch {
        return fallback("The AI reply couldn't be parsed this time - showing the offline study map instead. Try generating again.");
      }
      return { aiGenerated: true as const, notice: null, map };
    }),
});
