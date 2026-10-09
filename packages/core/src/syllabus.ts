import type { SyllabusMilestoneType } from "./constants";
import type { StudyPlanDay, SyllabusMilestone } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const TYPE_LABELS: Record<SyllabusMilestoneType, string> = {
  FINAL: "Final",
  MIDTERM: "Midterm",
  EXAM: "Exam",
  QUIZ: "Quiz",
  HOMEWORK: "Homework",
  PROJECT: "Project",
  READING: "Reading",
  LAB: "Lab",
  OFFICE_HOURS: "Review session",
  OTHER: "Milestone",
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startUtcDay(date: Date): Date {
  return new Date(`${isoDate(date)}T12:00:00.000Z`);
}

function addDaysIso(iso: string, days: number): string {
  return isoDate(new Date(Date.parse(`${iso}T12:00:00.000Z`) + days * DAY_MS));
}

function toIsoDate(
  year: number | null,
  monthIndex: number,
  day: number,
  now: Date
): string | null {
  const inferredYear = year ?? now.getUTCFullYear();
  const fullYear = inferredYear < 100 ? 2000 + inferredYear : inferredYear;
  let candidate = new Date(Date.UTC(fullYear, monthIndex, day, 12));
  if (
    candidate.getUTCFullYear() !== fullYear ||
    candidate.getUTCMonth() !== monthIndex ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  if (year === null) {
    const tooFarPast = new Date(startUtcDay(now).getTime() - 21 * DAY_MS);
    if (candidate < tooFarPast) {
      candidate = new Date(Date.UTC(fullYear + 1, monthIndex, day, 12));
    }
  }

  return isoDate(candidate);
}

function findDateMatches(line: string, now: Date): Array<{ raw: string; iso: string }> {
  const matches: Array<{ raw: string; iso: string }> = [];

  for (const match of line.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    const iso = toIsoDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]), now);
    if (iso) matches.push({ raw: match[0], iso });
  }

  for (const match of line.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{2,4}))?\b/gi
  )) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    const iso = toIsoDate(match[3] ? Number(match[3]) : null, month, Number(match[2]), now);
    if (iso) matches.push({ raw: match[0], iso });
  }

  for (const match of line.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g)) {
    const iso = toIsoDate(match[3] ? Number(match[3]) : null, Number(match[1]) - 1, Number(match[2]), now);
    if (iso) matches.push({ raw: match[0], iso });
  }

  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.iso}:${match.raw}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyMilestone(text: string): SyllabusMilestoneType {
  const s = text.toLowerCase();
  if (/\bfinal\b/.test(s)) return "FINAL";
  if (/\bmidterm\b/.test(s)) return "MIDTERM";
  if (/\bexam|test\b/.test(s)) return "EXAM";
  if (/\bquiz\b/.test(s)) return "QUIZ";
  if (/\bproject|presentation|milestone|proposal|demo\b/.test(s)) return "PROJECT";
  if (/\bread|reading|chapter|textbook\b/.test(s)) return "READING";
  if (/\blab|recitation\b/.test(s)) return "LAB";
  if (/\boffice hour|review session|study session\b/.test(s)) return "OFFICE_HOURS";
  if (/\bhomework|assignment|problem set|pset|essay|paper|due\b/.test(s)) return "HOMEWORK";
  return "OTHER";
}

function prepDaysForType(type: SyllabusMilestoneType): number {
  if (type === "FINAL") return 14;
  if (type === "MIDTERM") return 10;
  if (type === "EXAM" || type === "PROJECT") return 7;
  if (type === "QUIZ" || type === "HOMEWORK") return 3;
  if (type === "LAB") return 2;
  if (type === "READING") return 1;
  return 2;
}

function minutesForType(type: SyllabusMilestoneType): number {
  if (type === "FINAL" || type === "MIDTERM" || type === "EXAM" || type === "PROJECT") return 55;
  if (type === "READING") return 25;
  return 40;
}

function prepOffsets(prepDays: number): number[] {
  if (prepDays >= 10) return [prepDays, Math.ceil(prepDays / 2), 1];
  if (prepDays >= 5) return [prepDays, 2];
  if (prepDays >= 2) return [prepDays, 1];
  if (prepDays === 1) return [1];
  return [];
}

function cleanTitle(line: string, rawDate: string, type: SyllabusMilestoneType): string {
  const cleaned = line
    .replace(rawDate, " ")
    .replace(/\b(due|deadline|date|on|by)\b:?/gi, " ")
    .replace(/^[\s*#\-:|]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:|\-]+$/, "")
    .trim();
  if (cleaned.length >= 3) return cleaned.slice(0, 180);
  return `${TYPE_LABELS[type]} milestone`;
}

function extractWeight(line: string): string | undefined {
  return line.match(/\b\d{1,3}\s?%|\b\d{1,4}\s+points?\b/i)?.[0];
}

function extractTopics(line: string, title: string): string[] {
  const parts = line.split(/[:|\-\u2013\u2014]/).map((part) => part.trim()).filter(Boolean);
  const candidate = parts.length > 1 ? parts[parts.length - 1] : "";
  const cleaned = candidate
    .replace(/\b(20\d{2})-\d{1,2}-\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, "")
    .replace(/\b\d{1,3}\s?%|\b\d{1,4}\s+points?\b/gi, "")
    .replace(/\b(due|deadline|exam|quiz|homework|assignment|project|reading|lab|final|midterm)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 3 && cleaned.toLowerCase() !== title.toLowerCase()) {
    return [cleaned.slice(0, 80)];
  }
  return [];
}

export function normalizeSyllabusMilestones(milestones: SyllabusMilestone[]): SyllabusMilestone[] {
  const seen = new Set<string>();
  return milestones
    .filter((milestone) => !Number.isNaN(Date.parse(`${milestone.date}T12:00:00.000Z`)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .filter((milestone) => {
      const key = `${milestone.date}:${milestone.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((milestone, index) => ({
      ...milestone,
      id: `m${index + 1}`,
      prepDays: milestone.prepDays ?? prepDaysForType(milestone.type),
      topics: [...new Set(milestone.topics.map((topic) => topic.trim()).filter(Boolean))].slice(0, 3),
    }));
}

export function extractSyllabusMilestonesFallback(text: string, now = new Date()): SyllabusMilestone[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 5);

  const milestones: SyllabusMilestone[] = [];

  for (const line of lines) {
    const dateMatches = findDateMatches(line, now);
    if (dateMatches.length === 0) continue;

    const hasAcademicSignal =
      /\b(final|midterm|exam|test|quiz|homework|assignment|problem set|pset|essay|paper|project|presentation|lab|reading|chapter|due|deadline|office hour|review session)\b/i.test(
        line
      );
    if (!hasAcademicSignal && line.length > 120) continue;

    for (const dateMatch of dateMatches) {
      const type = classifyMilestone(line);
      const title = cleanTitle(line, dateMatch.raw, type);
      milestones.push({
        id: `raw-${milestones.length + 1}`,
        title,
        type,
        date: dateMatch.iso,
        topics: extractTopics(line, title),
        weight: extractWeight(line),
        prepDays: prepDaysForType(type),
        sourceSnippet: line.slice(0, 300),
      });
    }
  }

  return normalizeSyllabusMilestones(milestones).slice(0, 32);
}

export function buildSyllabusAutopilotPlan(opts: {
  milestones: SyllabusMilestone[];
  now?: Date;
}): StudyPlanDay[] {
  const today = isoDate(opts.now ?? new Date());
  const byDate = new Map<string, StudyPlanDay>();

  function upsert(
    date: string,
    kind: StudyPlanDay["kind"],
    milestoneType: SyllabusMilestoneType,
    topics: string[],
    minutes: number
  ) {
    const existing = byDate.get(date);
    if (!existing) {
      byDate.set(date, {
        date,
        topics: topics.slice(0, 5),
        minutes,
        done: false,
        kind,
        source: "syllabus",
        milestoneType,
      });
      return;
    }

    existing.kind = existing.kind === "deadline" || kind === "deadline" ? "deadline" : "study";
    existing.milestoneType = kind === "deadline" ? milestoneType : existing.milestoneType;
    existing.minutes = Math.min(90, existing.minutes + minutes);
    for (const topic of topics) {
      if (!existing.topics.includes(topic) && existing.topics.length < 6) existing.topics.push(topic);
    }
  }

  for (const milestone of opts.milestones) {
    if (milestone.date < today) continue;

    const leadDays = milestone.prepDays ?? prepDaysForType(milestone.type);
    for (const offset of prepOffsets(leadDays)) {
      const prepDate = addDaysIso(milestone.date, -offset);
      if (prepDate <= today || prepDate >= milestone.date) continue;
      const phase = offset === 1 ? "Final check" : offset >= leadDays ? "Start" : "Practice";
      const topic = `${phase}: ${milestone.title}`;
      upsert(
        prepDate,
        "study",
        milestone.type,
        [topic, ...milestone.topics].filter(Boolean),
        minutesForType(milestone.type)
      );
    }

    upsert(
      milestone.date,
      "deadline",
      milestone.type,
      [`${TYPE_LABELS[milestone.type]}: ${milestone.title}`],
      0
    );
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 48);
}

export function latestMilestoneDate(milestones: SyllabusMilestone[], now = new Date()): string {
  const today = isoDate(now);
  const future = milestones.filter((milestone) => milestone.date >= today);
  const candidates = future.length > 0 ? future : milestones;
  const finalLike = candidates.filter((milestone) => ["FINAL", "MIDTERM", "EXAM"].includes(milestone.type));
  const source = finalLike.length > 0 ? finalLike : candidates;
  return source.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? addDaysIso(today, 30);
}
