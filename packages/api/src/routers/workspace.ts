// Phase 2: study-group / project workspaces - members, a shared task
// board, and group chat.
//
// The task board lives on the Project row's `tasks` JSON column
// (ProjectTask[] - see packages/core/src/types.ts). EVERY workspace gets
// a Project row at creation, study groups included, so the board always
// exists.
//
// Chat is SIMPLE POLLING on the ChatMessage table (see ARCHITECTURE.md):
// clients refetch chat.list every CHAT_POLL_INTERVAL_MS. No websockets,
// no paid realtime service - plenty for study-group-sized rooms.
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  parseJsonColumn,
  ProjectTasksSchema,
  ProjectTaskStatusSchema,
  WorkspaceTypeSchema,
  type ProjectTask,
} from "@coursemind/core";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@coursemind/db";
import { router, protectedProcedure, requireEnrollment, requireWorkspaceMember } from "../trpc";

const CHAT_PAGE_SIZE = 100;

async function loadTasks(prisma: PrismaClient, workspaceId: string): Promise<ProjectTask[]> {
  const project = await prisma.project.findUnique({ where: { workspaceId } });
  return parseJsonColumn<ProjectTask[]>(project?.tasks ?? "[]", ProjectTasksSchema, []);
}

async function saveTasks(prisma: PrismaClient, workspaceId: string, tasks: ProjectTask[]) {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true },
  });
  await prisma.project.upsert({
    where: { workspaceId },
    update: { tasks: JSON.stringify(tasks) },
    create: { workspaceId, title: workspace.name, tasks: JSON.stringify(tasks) },
  });
}

export const workspaceRouter = router({
  /** All workspaces in a course, with membership + activity summary. */
  listByCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        select: { id: true, code: true, title: true },
      });
      const workspaces = await ctx.prisma.workspace.findMany({
        where: { courseId: input.courseId },
        include: {
          members: { select: { userId: true } },
          project: { select: { tasks: true } },
          _count: { select: { members: true, chatMessages: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        course,
        workspaces: workspaces.map((w) => {
          const tasks = parseJsonColumn<ProjectTask[]>(
            w.project?.tasks ?? "[]",
            ProjectTasksSchema,
            []
          );
          return {
            id: w.id,
            name: w.name,
            type: w.type,
            memberCount: w._count.members,
            messageCount: w._count.chatMessages,
            openTaskCount: tasks.filter((t) => t.status !== "DONE").length,
            joined: w.members.some((m) => m.userId === ctx.userId),
            createdAt: w.createdAt,
          };
        }),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        name: z.string().min(2).max(80),
        type: WorkspaceTypeSchema,
        description: z.string().max(2000).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const workspace = await ctx.prisma.workspace.create({
        data: {
          courseId: input.courseId,
          name: input.name,
          type: input.type,
          members: { create: { userId: ctx.userId, role: "OWNER" } },
          project: { create: { title: input.name, description: input.description } },
        },
      });
      return { id: workspace.id };
    }),

  join: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUniqueOrThrow({
        where: { id: input.workspaceId },
        select: { courseId: true },
      });
      await requireEnrollment(ctx.userId, workspace.courseId);
      await ctx.prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.userId } },
        update: {},
        create: { workspaceId: input.workspaceId, userId: ctx.userId },
      });
      return { ok: true };
    }),

  /** Full workspace payload: members, project, parsed task board. */
  get: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      const w = await ctx.prisma.workspace.findUniqueOrThrow({
        where: { id: input.workspaceId },
        include: {
          course: { select: { id: true, code: true, title: true } },
          members: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
          project: true,
        },
      });
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        course: w.course,
        myUserId: ctx.userId,
        members: w.members.map((m) => ({ userId: m.user.id, name: m.user.name, role: m.role })),
        project: {
          title: w.project?.title ?? w.name,
          description: w.project?.description ?? "",
          tasks: parseJsonColumn<ProjectTask[]>(w.project?.tasks ?? "[]", ProjectTasksSchema, []),
        },
      };
    }),

  // ---------- Task board ----------

  addTask: protectedProcedure
    .input(z.object({ workspaceId: z.string(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      const tasks = await loadTasks(ctx.prisma, input.workspaceId);
      const task: ProjectTask = {
        id: randomUUID(),
        title: input.title.trim(),
        assigneeId: null,
        status: "TODO",
      };
      await saveTasks(ctx.prisma, input.workspaceId, [...tasks, task]);
      return task;
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        taskId: z.string(),
        status: ProjectTaskStatusSchema.optional(),
        assigneeId: z.string().nullable().optional(),
        title: z.string().min(1).max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      const tasks = await loadTasks(ctx.prisma, input.workspaceId);
      const task = tasks.find((t) => t.id === input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "That task no longer exists." });
      if (input.status !== undefined) task.status = input.status;
      if (input.assigneeId !== undefined) task.assigneeId = input.assigneeId;
      if (input.title !== undefined) task.title = input.title.trim();
      await saveTasks(ctx.prisma, input.workspaceId, tasks);
      return task;
    }),

  deleteTask: protectedProcedure
    .input(z.object({ workspaceId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      const tasks = await loadTasks(ctx.prisma, input.workspaceId);
      await saveTasks(
        ctx.prisma,
        input.workspaceId,
        tasks.filter((t) => t.id !== input.taskId)
      );
      return { ok: true };
    }),

  updateProject: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        title: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      await ctx.prisma.project.update({
        where: { workspaceId: input.workspaceId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      return { ok: true };
    }),

  // ---------- Group chat (polled) ----------

  /** Last messages, oldest first. Clients poll this every few seconds. */
  chatList: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      const messages = await ctx.prisma.chatMessage.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        take: CHAT_PAGE_SIZE,
        include: { author: { select: { id: true, name: true } } },
      });
      return messages.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        authorName: m.author?.name ?? "Unknown",
        mine: m.author?.id === ctx.userId,
        createdAt: m.createdAt,
      }));
    }),

  chatSend: protectedProcedure
    .input(z.object({ workspaceId: z.string(), body: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx.userId, input.workspaceId);
      const message = await ctx.prisma.chatMessage.create({
        data: { workspaceId: input.workspaceId, authorId: ctx.userId, body: input.body.trim() },
      });
      return { id: message.id };
    }),
});
