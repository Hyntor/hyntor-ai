// XP + streak engine. Awarded from Phase 1 so the data already exists
// when the Phase 4 streaks/XP UI ships.
//
// Streak rule: compare the calendar day (UTC) of the user's last counted
// activity with today. Same day -> no change; yesterday -> streak + 1;
// anything older (or never) -> streak resets to 1.
import { prisma } from "@coursemind/db";
import { XP_RULES, type ActivityType } from "@coursemind/core";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function recordActivity(userId: string, type: ActivityType): Promise<void> {
  const points = XP_RULES[type];
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const now = new Date();
  const today = utcDay(now);
  const lastDay = user.lastActiveAt ? utcDay(user.lastActiveAt) : null;
  const yesterday = utcDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  let streakCount = user.streakCount;
  let streakBonus = 0;
  if (lastDay !== today) {
    streakCount = lastDay === yesterday ? user.streakCount + 1 : 1;
    streakBonus = XP_RULES.STREAK_DAY;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { xp: user.xp + points + streakBonus, streakCount, lastActiveAt: now },
    }),
    prisma.activityLog.create({ data: { userId, type, points: points + streakBonus } }),
  ]);
}
