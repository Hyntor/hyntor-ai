import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  buildFallbackStudyPlan,
  buildSyllabusAutopilotPlan,
  buildSyllabusExtractionPrompt,
  buildStudyPlanPrompt,
  extractSyllabusMilestonesFallback,
  extractJson,
  latestMilestoneDate,
  normalizeSyllabusMilestones,
  parseJsonColumn,
  StudyPlanScheduleSchema,
  SyllabusMilestonesSchema,
  type StudyPlanDay,
  type SyllabusMilestone,
} from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured } from "../ai";
import { recordActivity } from "../activity";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function weakTopicCounts(prisma: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["prisma"], userId: string, courseId: string) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId, quiz: { courseId } },
    select: { weakTopics: true },
  });
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    const topics = parseJsonColumn<string[]>(attempt.weakTopics, z.array(z.string()), []);
    for (const topic of topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

export const studyRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const enrollments = await ctx.prisma.enrollment.findMany({
      where: { userId: ctx.userId },
      include: {
        course: {
          include: { _count: { select: { materials: true, quizzes: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const courses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = enrollment.course;
        const [plans, totalFlashcards, dueFlashcards, weakTopics] = await Promise.all([
          ctx.prisma.studyPlan.findMany({
            where: { userId: ctx.userId, courseId: course.id },
            orderBy: { createdAt: "desc" },
            take: 3,
          }),
          ctx.prisma.flashcard.count({
            where: { userId: ctx.userId, courseId: course.id },
          }),
          ctx.prisma.flashcard.count({
            where: { userId: ctx.userId, courseId: course.id, nextReviewAt: { lte: now } },
          }),
          weakTopicCounts(ctx.prisma, ctx.userId, course.id),
        ]);

        const activePlan = plans
          .map((plan) => {
            const schedule = parseJsonColumn<StudyPlanDay[]>(plan.schedule, StudyPlanScheduleSchema, []);
            const completedDays = schedule.filter((day) => day.done).length;
            const nextDay =
              schedule
                .filter((day) => !day.done)
                .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
            return {
              id: plan.id,
              examDate: plan.examDate,
              nextDay,
              completedDays,
              totalDays: schedule.length,
            };
          })
          .find((plan) => plan.nextDay || plan.totalDays > 0);

        return {
          id: course.id,
          code: course.code,
          title: course.title,
          materialCount: course._count.materials,
          quizCount: course._count.quizzes,
          flashcards: { total: totalFlashcards, due: dueFlashcards },
          weakTopics: weakTopics.slice(0, 3),
          activePlan: activePlan ?? null,
        };
      })
    );

    return {
      courses,
      totals: {
        dueFlashcards: courses.reduce((sum, course) => sum + course.flashcards.due, 0),
        weakTopics: courses.reduce((sum, course) => sum + course.weakTopics.length, 0),
        activePlans: courses.filter((course) => course.activePlan).length,
      },
    };
  }),

  courseDashboard: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const now = new Date();
      const [course, plans, totalFlashcards, dueFlashcards, weakTopics] = await Promise.all([
        ctx.prisma.course.findUniqueOrThrow({
          where: { id: input.courseId },
          select: {
            id: true,
            code: true,
            title: true,
            materials: {
              orderBy: { createdAt: "desc" },
              select: { id: true, title: true, type: true, extractedText: true },
            },
          },
        }),
        ctx.prisma.studyPlan.findMany({
          where: { userId: ctx.userId, courseId: input.courseId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        ctx.prisma.flashcard.count({
          where: { userId: ctx.userId, courseId: input.courseId },
        }),
        ctx.prisma.flashcard.count({
          where: { userId: ctx.userId, courseId: input.courseId, nextReviewAt: { lte: now } },
        }),
        weakTopicCounts(ctx.prisma, ctx.userId, input.courseId),
      ]);

      const parsedPlans = plans.map((plan) => ({
        id: plan.id,
        examDate: plan.examDate,
        createdAt: plan.createdAt,
        schedule: parseJsonColumn<StudyPlanDay[]>(plan.schedule, StudyPlanScheduleSchema, []),
      }));
      const deadlineMap = new Map<string, { date: string; title: string; type: string; done: boolean }>();
      for (const day of parsedPlans.flatMap((plan) => plan.schedule)) {
        if (day.kind !== "deadline") continue;
        const title = day.topics[0] ?? "Syllabus deadline";
        deadlineMap.set(`${day.date}:${title}`, {
          date: day.date,
          title,
          type: day.milestoneType ?? "OTHER",
          done: day.done,
        });
      }
      const deadlines = [...deadlineMap.values()].sort((a, b) => a.date.localeCompare(b.date));

      return {
        course: { id: course.id, code: course.code, title: course.title },
        materials: course.materials.map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          hasText: m.extractedText.trim().length > 0,
        })),
        plans: parsedPlans,
        deadlines,
        flashcards: { total: totalFlashcards, due: dueFlashcards },
        weakTopics,
      };
    }),

  importSyllabus: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        title: z.string().min(1).max(200).default("Course syllabus"),
        text: z.string().min(80).max(400_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        select: { id: true, code: true, title: true },
      });

      let milestones: SyllabusMilestone[] = extractSyllabusMilestonesFallback(input.text);

      if (isAiConfigured()) {
        try {
          const raw = await askClaude({
            system: "You extract course-calendar data from syllabi. Respond with ONLY valid JSON.",
            messages: [
              {
                role: "user",
                content: buildSyllabusExtractionPrompt({
                  courseTitle: `${course.code} - ${course.title}`,
                  todayIso: isoDate(new Date()),
                  syllabusText: input.text.slice(0, 60_000),
                }),
              },
            ],
            maxTokens: 4096,
          });
          const parsed = SyllabusMilestonesSchema.safeParse(extractJson(raw));
          if (parsed.success && parsed.data.length > 0) {
            milestones = normalizeSyllabusMilestones(parsed.data);
          }
        } catch {
          // Keep the feature useful in local/dev environments even if the model call fails.
        }
      }

      const schedule = buildSyllabusAutopilotPlan({ milestones });
      const examDate = new Date(`${latestMilestoneDate(milestones)}T12:00:00.000Z`);

      const { material, plan } = await ctx.prisma.$transaction(async (tx) => {
        const material = await tx.material.create({
          data: {
            courseId: input.courseId,
            uploaderId: ctx.userId,
            title: input.title,
            type: "SYLLABUS",
            extractedText: input.text,
          },
        });
        const plan =
          schedule.length > 0
            ? await tx.studyPlan.create({
                data: {
                  userId: ctx.userId,
                  courseId: input.courseId,
                  examDate,
                  schedule: JSON.stringify(schedule),
                },
              })
            : null;
        return { material, plan };
      });
      await recordActivity(ctx.userId, "MATERIAL_UPLOADED");

      return {
        materialId: material.id,
        planId: plan?.id ?? null,
        milestones,
        schedule,
      };
    }),

  createPlan: protectedProcedure
    .input(z.object({ courseId: z.string(), examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const examDate = new Date(`${input.examDate}T12:00:00.000Z`);
      if (Number.isNaN(examDate.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use a valid exam date." });
      }

      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        include: {
          materials: {
            orderBy: { createdAt: "asc" },
            select: { title: true, type: true, extractedText: true },
          },
        },
      });
      const weakTopics = (await weakTopicCounts(ctx.prisma, ctx.userId, input.courseId)).map((t) => t.topic);
      const materialTitles = course.materials.map((m) => m.title);
      const syllabusText =
        course.materials.find((m) => m.type === "SYLLABUS" && m.extractedText.trim())?.extractedText.slice(0, 32_000) ??
        null;

      let schedule = buildFallbackStudyPlan({
        examDate,
        topics: [...weakTopics, ...materialTitles],
      });

      if (isAiConfigured()) {
        const raw = await askClaude({
          system: "You create realistic, sustainable study schedules. Respond with ONLY valid JSON.",
          messages: [
            {
              role: "user",
              content: buildStudyPlanPrompt({
                courseTitle: `${course.code} - ${course.title}`,
                todayIso: isoDate(new Date()),
                examDateIso: input.examDate,
                materialTitles,
                syllabusText,
                weakTopics,
              }),
            },
          ],
          maxTokens: 4096,
        });
        const parsed = StudyPlanScheduleSchema.safeParse(extractJson(raw));
        if (parsed.success && parsed.data.length > 0) schedule = parsed.data;
      }

      const plan = await ctx.prisma.studyPlan.create({
        data: {
          userId: ctx.userId,
          courseId: input.courseId,
          examDate,
          schedule: JSON.stringify(schedule),
        },
      });

      return { id: plan.id, schedule };
    }),

  toggleDay: protectedProcedure
    .input(z.object({ planId: z.string(), date: z.string(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.studyPlan.findUniqueOrThrow({ where: { id: input.planId } });
      if (plan.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const schedule = parseJsonColumn<StudyPlanDay[]>(plan.schedule, StudyPlanScheduleSchema, []);
      const next = schedule.map((day) =>
        day.date === input.date ? { ...day, done: input.done } : day
      );
      await ctx.prisma.studyPlan.update({
        where: { id: plan.id },
        data: { schedule: JSON.stringify(next) },
      });
      return { schedule: next };
    }),
});
