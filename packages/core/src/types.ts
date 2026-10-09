// Zod schemas + TypeScript types for every JSON payload stored in the
// database (Quiz.questions, QuizAttempt.answers, TutorSession.messages,
// Project.tasks, StudyPlan.schedule). Parse on read, validate on write  -
// if bad JSON ever lands in the DB, these schemas catch it at the boundary
// instead of crashing deep inside a React component.
import { z } from "zod";
import {
  QUESTION_TYPES,
  SYLLABUS_MILESTONE_TYPES,
  TASK_STATUSES,
  THREAD_CONTEXT_TYPES,
  TUTOR_MODES,
  WORKSPACE_TYPES,
} from "./constants";

// ---------- Quiz ----------

export const QuizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  topic: z.string().default("general"),
  prompt: z.string(),
  // mcq only:
  options: z.array(z.string()).optional(),
  correctOption: z.number().int().optional(),
  // short/code only - model answer used for grading + shown in review:
  sampleAnswer: z.string().optional(),
  explanation: z.string().default(""),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export const QuizQuestionsSchema = z.array(QuizQuestionSchema);

export const AttemptAnswerSchema = z.object({
  questionId: z.string(),
  response: z.string(), // for mcq this is the chosen option index as a string
  correct: z.boolean().nullable(), // null = not auto-gradable (no AI key) - review manually
  feedback: z.string().default(""),
});
export type AttemptAnswer = z.infer<typeof AttemptAnswerSchema>;
export const AttemptAnswersSchema = z.array(AttemptAnswerSchema);

// ---------- Tutor ----------

export const TutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  tier: z.number().int().min(0).max(4).optional(), // which hint tier the assistant used
  createdAt: z.string(), // ISO timestamp
});
export type TutorMessage = z.infer<typeof TutorMessageSchema>;
export const TutorMessagesSchema = z.array(TutorMessageSchema);

export const TutorModeSchema = z.enum(TUTOR_MODES);

// ---------- Workspaces & discussions (Phase 2) ----------

export const WorkspaceTypeSchema = z.enum(WORKSPACE_TYPES);
export const ThreadContextTypeSchema = z.enum(THREAD_CONTEXT_TYPES);
export const ProjectTaskStatusSchema = z.enum(TASK_STATUSES);

export const ProjectTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  assigneeId: z.string().nullable(),
  status: ProjectTaskStatusSchema,
});
export type ProjectTask = z.infer<typeof ProjectTaskSchema>;
export const ProjectTasksSchema = z.array(ProjectTaskSchema);

// ---------- Study plan (Phase 3) ----------

export const StudyPlanDaySchema = z.object({
  date: z.string(), // ISO date
  topics: z.array(z.string()),
  minutes: z.number().int(),
  done: z.boolean().default(false),
  kind: z.enum(["study", "deadline"]).default("study"),
  source: z.string().optional(),
  milestoneType: z.enum(SYLLABUS_MILESTONE_TYPES).optional(),
});
export type StudyPlanDay = z.infer<typeof StudyPlanDaySchema>;
export const StudyPlanScheduleSchema = z.array(StudyPlanDaySchema);

export const SyllabusMilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(180),
  type: z.enum(SYLLABUS_MILESTONE_TYPES).default("OTHER"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topics: z.array(z.string().min(1).max(80)).default([]),
  weight: z.string().max(80).optional(),
  prepDays: z.number().int().min(0).max(30).default(3),
  sourceSnippet: z.string().max(500).optional(),
});
export type SyllabusMilestone = z.infer<typeof SyllabusMilestoneSchema>;
export const SyllabusMilestonesSchema = z.array(SyllabusMilestoneSchema);

// ---------- Flashcards (Phase 3) ----------

export const FlashcardDraftSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});
export type FlashcardDraft = z.infer<typeof FlashcardDraftSchema>;
export const FlashcardDraftsSchema = z.array(FlashcardDraftSchema);

// ---------- Safe JSON helpers ----------

/** Parse a JSON column with a schema; returns fallback instead of throwing. */
// The third ZodType parameter is `unknown` so schemas with .default() fields
// (whose input type differs from their output type) are accepted.
export function parseJsonColumn<T>(
  raw: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  fallback: T
): T {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

/**
 * Extract the first JSON array/object out of an LLM response that may be
 * wrapped in prose or markdown fences. Returns null if nothing parses.
 */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const start = candidate.search(/[[{]/);
    if (start === -1) continue;
    // Walk from the first bracket, tracking depth, to find the matching close.
    const open = candidate[start];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === open) depth++;
      if (ch === close) depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
