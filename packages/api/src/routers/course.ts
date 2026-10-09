import { z } from "zod";
import { router, protectedProcedure, requireEnrollment } from "../trpc";

export const courseRouter = router({
  /** Courses the current user is enrolled in, with summary counts. */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const enrollments = await ctx.prisma.enrollment.findMany({
      where: { userId: ctx.userId },
      include: {
        course: {
          include: { _count: { select: { materials: true, quizzes: true, enrollments: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return enrollments.map((e) => ({
      id: e.course.id,
      code: e.course.code,
      title: e.course.title,
      subject: e.course.subject,
      description: e.course.description,
      isCrossUniversity: e.course.isCrossUniversity,
      roleInCourse: e.roleInCourse,
      materialCount: e.course._count.materials,
      quizCount: e.course._count.quizzes,
      memberCount: e.course._count.enrollments,
    }));
  }),

  /** Browse courses available to join (search by code/title).
   *
   *  Phase 2 cross-university scoping: a course "belongs to" the
   *  universities of its enrolled members (the creator auto-enrolls, so a
   *  new course is instantly visible to their university peers). You see
   *  courses with members from YOUR university, plus any course flagged
   *  isCrossUniversity - those are open to everyone. */
  browse: protectedProcedure
    .input(z.object({ query: z.string().max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const me = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { universityId: true },
      });
      const visibility = {
        OR: [
          { isCrossUniversity: true },
          { enrollments: { some: { user: { universityId: me.universityId } } } },
        ],
      };
      const q = input.query?.trim();
      const courses = await ctx.prisma.course.findMany({
        where: q
          ? {
              AND: [
                visibility,
                { OR: [{ code: { contains: q } }, { title: { contains: q } }, { subject: { contains: q } }] },
              ],
            }
          : visibility,
        include: {
          _count: { select: { enrollments: true, materials: true } },
          enrollments: { select: { user: { select: { universityId: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const myEnrollments = await ctx.prisma.enrollment.findMany({
        where: { userId: ctx.userId },
        select: { courseId: true },
      });
      const mine = new Set(myEnrollments.map((e) => e.courseId));
      return courses.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        subject: c.subject,
        description: c.description,
        isCrossUniversity: c.isCrossUniversity,
        schoolMatched: c.enrollments.some((enrollment) => enrollment.user.universityId === me.universityId),
        memberCount: c._count.enrollments,
        materialCount: c._count.materials,
        joined: mine.has(c.id),
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        code: z.string().min(2).max(20),
        title: z.string().min(3).max(120),
        subject: z.string().min(2).max(60),
        description: z.string().max(2000).default(""),
        isCrossUniversity: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.create({
        data: { ...input, code: input.code.toUpperCase() },
      });
      await ctx.prisma.enrollment.create({
        data: { userId: ctx.userId, courseId: course.id, roleInCourse: "STUDENT" },
      });
      return { id: course.id };
    }),

  join: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.enrollment.upsert({
        where: { userId_courseId: { userId: ctx.userId, courseId: input.courseId } },
        update: {},
        create: { userId: ctx.userId, courseId: input.courseId },
      });
      return { ok: true };
    }),

  /** Full course page payload: materials, quizzes, member count. */
  get: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        include: {
          materials: {
            orderBy: [{ upvoteCount: "desc" }, { createdAt: "desc" }],
            include: { uploader: { select: { name: true } } },
          },
          quizzes: {
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { attempts: true } } },
          },
          enrollments: { select: { user: { select: { universityId: true } } } },
          _count: { select: { enrollments: true } },
        },
      });
      return {
        id: course.id,
        code: course.code,
        title: course.title,
        subject: course.subject,
        description: course.description,
        isCrossUniversity: course.isCrossUniversity,
        universityCount: new Set(course.enrollments.map((e) => e.user.universityId)).size,
        memberCount: course._count.enrollments,
        materials: course.materials.map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          uploaderName: m.uploader.name,
          upvoteCount: m.upvoteCount,
          hasText: m.extractedText.length > 0,
          createdAt: m.createdAt,
        })),
        quizzes: course.quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          isMockExam: q.isMockExam,
          attemptCount: q._count.attempts,
          createdAt: q.createdAt,
        })),
      };
    }),
});
