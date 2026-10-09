// Phase 4: the leaderboard - the visible payoff for the XP + streak data
// that's been collecting since Phase 1.
//
// Two scopes, chosen by the client:
//   - university (default): everyone at the student's school
//   - course: just the members of one course they're enrolled in
//
// We always return the current user's own rank, even when they fall below
// the visible top slice, so the board never feels like it's hiding them.
// The "how you earned it" breakdown reads ActivityLog (type + points),
// the same rows recordActivity has been writing all along.
import { z } from "zod";
import { XP_RULE_LABELS, type ActivityType } from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";

const TOP_N = 20;

export const leaderboardRouter = router({
  get: protectedProcedure
    .input(z.object({ courseId: z.string().nullable().default(null) }))
    .query(async ({ ctx, input }) => {
      const me = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { universityId: true, university: { select: { name: true } } },
      });

      // Build the population filter for the chosen scope.
      let where;
      let scopeLabel: string;
      if (input.courseId) {
        await requireEnrollment(ctx.userId, input.courseId);
        const course = await ctx.prisma.course.findUniqueOrThrow({
          where: { id: input.courseId },
          select: { code: true },
        });
        where = { enrollments: { some: { courseId: input.courseId } } };
        scopeLabel = `${course.code} members`;
      } else {
        where = { universityId: me.universityId };
        scopeLabel = me.university.name;
      }

      // Rank by XP, then streak as a tiebreaker. Pull the whole scoped
      // population (student bodies are small here) so we can compute an
      // exact rank for the current user without a window function.
      const ranked = await ctx.prisma.user.findMany({
        where,
        orderBy: [{ xp: "desc" }, { streakCount: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, role: true, xp: true, streakCount: true },
      });

      const myIndex = ranked.findIndex((u) => u.id === ctx.userId);
      const entries = ranked.slice(0, TOP_N).map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        name: u.name,
        role: u.role,
        xp: u.xp,
        streakCount: u.streakCount,
        isMe: u.id === ctx.userId,
      }));

      const myRankEntry =
        myIndex === -1
          ? null
          : {
              rank: myIndex + 1,
              userId: ranked[myIndex].id,
              name: ranked[myIndex].name,
              role: ranked[myIndex].role,
              xp: ranked[myIndex].xp,
              streakCount: ranked[myIndex].streakCount,
              isMe: true,
            };

      // The current user's own XP breakdown by activity type.
      const grouped = await ctx.prisma.activityLog.groupBy({
        by: ["type"],
        where: { userId: ctx.userId },
        _sum: { points: true },
        _count: { _all: true },
      });
      const breakdown = grouped
        .map((g) => ({
          type: g.type as ActivityType,
          label: XP_RULE_LABELS[g.type as ActivityType] ?? g.type,
          points: g._sum.points ?? 0,
          count: g._count._all,
        }))
        .filter((b) => XP_RULE_LABELS[b.type] !== undefined)
        .sort((a, b) => b.points - a.points);

      return {
        scopeLabel,
        participantCount: ranked.length,
        entries,
        me: myRankEntry,
        breakdown,
      };
    }),
});
