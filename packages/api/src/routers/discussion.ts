// Phase 2: discussion boards - threads attached to a course (or to a
// specific exam/quiz/material) where the AI tutor can be INVOKED as a
// participant.
//
// AI posts are stored with authorId = null. The body keeps its [TIER:n]
// marker in the database so the tier badge survives reloads; get() strips
// it before anyone sees the text (same trick as the tutor chat).
//
// Public-board tier policy (see buildDiscussionTutorPrompt in core):
// the ceiling starts at Tier 1 and rises with real student engagement
// (posts in the thread), but caps at DISCUSSION_MAX_TIER (3) - a Tier 4
// structured walkthrough of graded work, visible to the whole class,
// would be answer-dumping by proxy.
import { z } from "zod";
import {
  buildDiscussionTutorPrompt,
  extractTierMarker,
  DISCUSSION_MAX_TIER,
  ThreadContextTypeSchema,
  type ThreadContextType,
} from "@coursemind/core";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "../ai";
import { gatherGrounding } from "../grounding";

const AI_AUTHOR_NAME = "Hyntor Tutor";

export const discussionRouter = router({
  /** Threads in a course, optionally filtered by context type (e.g. EXAM). */
  listByCourse: protectedProcedure
    .input(z.object({ courseId: z.string(), contextType: ThreadContextTypeSchema.optional() }))
    .query(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        select: { id: true, code: true, title: true },
      });
      const threads = await ctx.prisma.discussionThread.findMany({
        where: {
          courseId: input.courseId,
          ...(input.contextType ? { contextType: input.contextType } : {}),
        },
        include: {
          creator: { select: { name: true } },
          posts: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, authorId: true },
          },
          _count: { select: { posts: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        course,
        threads: threads.map((t) => ({
          id: t.id,
          title: t.title,
          contextType: t.contextType,
          creatorName: t.creator.name,
          postCount: t._count.posts,
          lastPostAt: t.posts[0]?.createdAt ?? t.createdAt,
          lastPostByTutor: t.posts[0]?.authorId === null && t.posts.length > 0,
          createdAt: t.createdAt,
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        title: z.string().min(3).max(200),
        contextType: ThreadContextTypeSchema.default("COURSE"),
        contextId: z.string().nullable().default(null),
        body: z.string().min(1).max(10_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const thread = await ctx.prisma.discussionThread.create({
        data: {
          courseId: input.courseId,
          title: input.title.trim(),
          contextType: input.contextType,
          contextId: input.contextId,
          creatorId: ctx.userId,
          posts: { create: { authorId: ctx.userId, body: input.body } },
        },
      });
      return { id: thread.id };
    }),

  /** Full thread payload: posts in order, AI posts with their tier. */
  get: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.prisma.discussionThread.findUniqueOrThrow({
        where: { id: input.threadId },
        include: {
          course: { select: { id: true, code: true, title: true } },
          creator: { select: { name: true } },
          posts: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { id: true, name: true } } },
          },
        },
      });
      await requireEnrollment(ctx.userId, thread.courseId);
      return {
        id: thread.id,
        title: thread.title,
        contextType: thread.contextType,
        course: thread.course,
        creatorName: thread.creator.name,
        aiConfigured: isAiConfigured(),
        posts: thread.posts.map((p) => {
          const isAi = p.author === null;
          const { content, tier } = isAi
            ? extractTierMarker(p.body)
            : { content: p.body, tier: null };
          return {
            id: p.id,
            body: content,
            tier,
            isAi,
            authorName: p.author?.name ?? AI_AUTHOR_NAME,
            parentPostId: p.parentPostId,
            createdAt: p.createdAt,
          };
        }),
      };
    }),

  reply: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        body: z.string().min(1).max(10_000),
        parentPostId: z.string().nullable().default(null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.prisma.discussionThread.findUniqueOrThrow({
        where: { id: input.threadId },
        select: { id: true, courseId: true },
      });
      await requireEnrollment(ctx.userId, thread.courseId);
      if (input.parentPostId) {
        const parent = await ctx.prisma.discussionPost.findUnique({
          where: { id: input.parentPostId },
          select: { threadId: true },
        });
        if (parent?.threadId !== thread.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That post isn't in this thread." });
        }
      }
      const post = await ctx.prisma.discussionPost.create({
        data: {
          threadId: thread.id,
          authorId: ctx.userId,
          body: input.body,
          parentPostId: input.parentPostId,
        },
      });
      return { id: post.id };
    }),

  /** Invoke the AI tutor into the thread: it reads the whole discussion
   *  and posts ONE hint-based reply (authorId = null). */
  askTutor: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.prisma.discussionThread.findUniqueOrThrow({
        where: { id: input.threadId },
        include: {
          course: { select: { id: true, title: true } },
          posts: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { name: true } } },
          },
        },
      });
      await requireEnrollment(ctx.userId, thread.courseId);

      // No key? Tell the class kindly, don't persist anything, don't 500.
      if (!isAiConfigured()) {
        return { aiConfigured: false as const, message: AI_NOT_CONFIGURED_MESSAGE };
      }

      // The ceiling rises as students engage in the thread, capped at 3.
      const studentPostCount = thread.posts.filter((p) => p.author !== null).length;
      const maxTierAllowed = Math.max(1, Math.min(studentPostCount, DISCUSSION_MAX_TIER));

      const grounding = await gatherGrounding(ctx.prisma, thread.courseId);
      const system = buildDiscussionTutorPrompt({
        courseTitle: thread.course.title,
        threadTitle: thread.title,
        contextType: thread.contextType as ThreadContextType,
        materials: grounding,
        maxTierAllowed,
      });

      // The whole thread becomes ONE user message: a labeled transcript.
      const transcript = thread.posts
        .map((p) =>
          p.author
            ? `[${p.author.name}]\n${p.body}`
            : `[${AI_AUTHOR_NAME} - you, earlier]\n${extractTierMarker(p.body).content}`
        )
        .join("\n\n---\n\n");

      const raw = await askClaude({
        system,
        messages: [
          {
            role: "user",
            content: `${transcript}\n\n---\n\n(Write your reply post to the thread now.)`,
          },
        ],
      });
      const { content, tier } = extractTierMarker(raw);

      // Store WITH the marker so the tier badge survives reloads;
      // get() strips it on the way out.
      const post = await ctx.prisma.discussionPost.create({
        data: {
          threadId: thread.id,
          authorId: null,
          body: tier === null ? content : `[TIER:${tier}] ${content}`,
        },
      });

      return {
        aiConfigured: true as const,
        post: {
          id: post.id,
          body: content,
          tier,
          isAi: true,
          authorName: AI_AUTHOR_NAME,
          parentPostId: null,
          createdAt: post.createdAt,
        },
      };
    }),
});
