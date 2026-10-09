// Course-wide GROUP CHAT (free) + the AI assistant in it (Pro).
//
// FREE: everyone enrolled shares one live chat per course (simple polling on
// ChatMessage, courseId set). PRO: "Ask AI" reads the recent chat + the
// course's shared materials and posts one grounded, hint-based reply
// (authorId null, tier recorded) - the paid differentiator.
import { z } from "zod";
import {
  buildDiscussionTutorPrompt,
  extractTierMarker,
  DISCUSSION_MAX_TIER,
} from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "../ai";
import { gatherGrounding } from "../grounding";

const CHAT_PAGE_SIZE = 100;
const AI_TRANSCRIPT_LIMIT = 30;
const AI_AUTHOR_NAME = "Hyntor AI";

export const courseChatRouter = router({
  /** Recent messages oldest-first. Clients poll this every few seconds. */
  list: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const messages = await ctx.prisma.chatMessage.findMany({
        where: { courseId: input.courseId },
        orderBy: { createdAt: "desc" },
        take: CHAT_PAGE_SIZE,
        include: { author: { select: { id: true, name: true } } },
      });
      return messages.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        isAi: m.authorId === null,
        tier: m.tier,
        authorName: m.author?.name ?? AI_AUTHOR_NAME,
        mine: m.author?.id === ctx.userId,
        createdAt: m.createdAt,
      }));
    }),

  send: protectedProcedure
    .input(z.object({ courseId: z.string(), body: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const message = await ctx.prisma.chatMessage.create({
        data: { courseId: input.courseId, authorId: ctx.userId, body: input.body.trim() },
      });
      return { id: message.id };
    }),

  /** PRO: read the recent chat + materials and post one AI reply to the group. */
  askAi: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);

      const me = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { plan: true },
      });
      if (me.plan !== "PRO") {
        return { ok: false as const, upgradeRequired: true as const, message: null };
      }
      if (!isAiConfigured()) {
        return { ok: false as const, upgradeRequired: false as const, message: AI_NOT_CONFIGURED_MESSAGE };
      }

      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        select: { title: true },
      });
      const recent = await ctx.prisma.chatMessage.findMany({
        where: { courseId: input.courseId },
        orderBy: { createdAt: "desc" },
        take: AI_TRANSCRIPT_LIMIT,
        include: { author: { select: { name: true } } },
      });
      const ordered = recent.reverse();
      // Ceiling rises with real student engagement, capped for a public room.
      const studentMessages = ordered.filter((m) => m.authorId !== null).length;
      const maxTierAllowed = Math.max(1, Math.min(studentMessages, DISCUSSION_MAX_TIER));

      const grounding = await gatherGrounding(ctx.prisma, input.courseId);
      const system = buildDiscussionTutorPrompt({
        courseTitle: course.title,
        threadTitle: "the class group chat",
        contextType: "COURSE",
        materials: grounding,
        maxTierAllowed,
      });
      const transcript = ordered
        .map((m) =>
          m.author
            ? `[${m.author.name}]\n${m.body}`
            : `[${AI_AUTHOR_NAME} - you, earlier]\n${m.body}`
        )
        .join("\n\n---\n\n");

      const raw = await askClaude({
        system,
        messages: [
          { role: "user", content: `${transcript}\n\n---\n\n(Reply to the group's latest message now.)` },
        ],
      });
      const { content, tier } = extractTierMarker(raw);

      const message = await ctx.prisma.chatMessage.create({
        data: { courseId: input.courseId, authorId: null, body: content, tier: tier ?? undefined },
      });
      return {
        ok: true as const,
        upgradeRequired: false as const,
        message: {
          id: message.id,
          body: content,
          isAi: true,
          tier,
          authorName: AI_AUTHOR_NAME,
          mine: false,
          createdAt: message.createdAt,
        },
      };
    }),
});
