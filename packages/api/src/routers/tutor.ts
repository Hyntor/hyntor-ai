// The tutor router - where the Section 6 mechanic actually runs.
//
// Tier escalation is enforced HERE, server-side, not by trusting the model:
// for ASSIGNMENT_HELP the allowed ceiling starts at Tier 1 and rises by one
// per student message (capped at 4) - the student "earns" deeper help by
// engaging. The model reports the tier it used via a [TIER:n] prefix, which
// we strip and record on TutorSession.tierReached.
import { z } from "zod";
import {
  buildTutorSystemPrompt,
  extractTierMarker,
  parseJsonColumn,
  TutorMessagesSchema,
  TutorModeSchema,
  type TutorMessage,
} from "@coursemind/core";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "../ai";
import { gatherGrounding } from "../grounding";
import { recordActivity } from "../activity";

function computeMaxTier(mode: string, priorUserMessages: number): number {
  if (mode === "CONCEPT") return 0;
  if (mode === "ASSIGNMENT_HELP") return Math.min(1 + priorUserMessages, 4);
  return 4; // CODE_REVIEW / DEBUG: governed by their mode prompts, not the ladder
}

export const tutorRouter = router({
  createSession: protectedProcedure
    .input(z.object({ mode: TutorModeSchema, courseId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.courseId) await requireEnrollment(ctx.userId, input.courseId);
      const session = await ctx.prisma.tutorSession.create({
        data: { userId: ctx.userId, courseId: input.courseId, mode: input.mode },
      });
      await recordActivity(ctx.userId, "TUTOR_SESSION");
      return { id: session.id };
    }),

  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await ctx.prisma.tutorSession.findMany({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { course: { select: { code: true } } },
    });
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      courseCode: s.course?.code ?? null,
      tierReached: s.tierReached,
      updatedAt: s.updatedAt,
    }));
  }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.tutorSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: { course: { select: { id: true, code: true, title: true } } },
      });
      if (session.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      return {
        id: session.id,
        title: session.title,
        mode: session.mode,
        course: session.course,
        tierReached: session.tierReached,
        messages: parseJsonColumn<TutorMessage[]>(session.messages, TutorMessagesSchema, []),
        aiConfigured: isAiConfigured(),
      };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ sessionId: z.string(), content: z.string().min(1).max(20_000) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.tutorSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: { course: { select: { id: true, title: true } } },
      });
      if (session.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });

      // No key? Tell the student kindly, don't persist anything, don't 500.
      if (!isAiConfigured()) {
        return {
          content: AI_NOT_CONFIGURED_MESSAGE,
          tier: null,
          aiConfigured: false as const,
        };
      }

      const history = parseJsonColumn<TutorMessage[]>(session.messages, TutorMessagesSchema, []);
      const priorUserMessages = history.filter((m) => m.role === "user").length;
      const maxTierAllowed = computeMaxTier(session.mode, priorUserMessages);

      const grounding = session.course ? await gatherGrounding(ctx.prisma, session.course.id) : [];
      const system = buildTutorSystemPrompt({
        mode: session.mode as "CONCEPT" | "ASSIGNMENT_HELP" | "CODE_REVIEW" | "DEBUG",
        courseTitle: session.course?.title ?? null,
        materials: grounding,
        maxTierAllowed,
      });

      const raw = await askClaude({
        system,
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: input.content },
        ],
      });
      const { content, tier } = extractTierMarker(raw);

      const now = new Date().toISOString();
      const updated: TutorMessage[] = [
        ...history,
        { role: "user", content: input.content, createdAt: now },
        { role: "assistant", content, tier: tier ?? undefined, createdAt: now },
      ];

      await ctx.prisma.tutorSession.update({
        where: { id: session.id },
        data: {
          messages: JSON.stringify(updated),
          tierReached: Math.max(session.tierReached, tier ?? 0),
          // First message names the session so the sidebar list is readable.
          ...(history.length === 0
            ? { title: input.content.slice(0, 60) + (input.content.length > 60 ? "…" : "") }
            : {}),
        },
      });

      return { content, tier, aiConfigured: true as const };
    }),
});
