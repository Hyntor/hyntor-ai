// Fallback study-plan generator (Phase 3). When no ANTHROPIC_API_KEY is
// configured, plans still work: a deterministic schedule that spreads the
// course's topics across the days before the exam. The AI path (see
// buildStudyPlanPrompt) produces smarter plans; this keeps the feature
// honest without one.
import type { StudyPlanDay } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_TOPICS = ["Review lecture notes", "Practice problems"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildFallbackStudyPlan(opts: {
  examDate: Date;
  topics: string[];
  now?: Date;
}): StudyPlanDay[] {
  const now = opts.now ?? new Date();
  const topics = opts.topics.length > 0 ? opts.topics : DEFAULT_TOPICS;

  const examDay = isoDate(opts.examDate);
  const totalDays = Math.floor(
    (Date.parse(examDay) - Date.parse(isoDate(now))) / DAY_MS
  );
  if (totalDays < 1) {
    // Exam is today (or data is odd): one honest cram-lightly day.
    return [{ date: examDay, topics: ["Light review - trust your prep, sleep well"], minutes: 30, done: false, kind: "study" }];
  }

  // Long horizon -> study every other day so the plan stays realistic.
  const stride = totalDays > 21 ? 2 : 1;

  const days: StudyPlanDay[] = [];
  let topicIndex = 0;
  for (let offset = 1; offset < totalDays; offset += stride) {
    const date = isoDate(new Date(Date.parse(isoDate(now)) + offset * DAY_MS));
    const todays: string[] = [];
    for (let i = 0; i < Math.min(2, topics.length); i++) {
      todays.push(topics[topicIndex % topics.length]);
      topicIndex++;
    }
    days.push({ date, topics: todays, minutes: 45, done: false, kind: "study" });
  }
  // Exam day: light review of everything, never new material.
  days.push({
    date: examDay,
    topics: ["Final review - skim notes, redo one practice problem per topic"],
    minutes: 30,
    done: false,
    kind: "study",
  });
  return days;
}
