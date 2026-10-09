// Single source of truth for every enum-like string stored in the database.
// (SQLite has no native enums, so the DB stores plain strings and THESE
// values + the zod schemas in types.ts are what keep them honest.)

export const USER_ROLES = ["STUDENT", "TA", "INSTRUCTOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Subscription plans. PRO unlocks the AI features (the group-chat tutor, etc.).
export const USER_PLANS = ["FREE", "PRO"] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const MATERIAL_TYPES = ["PDF", "PPTX", "DOCX", "NOTES", "SYLLABUS", "TEXT", "OTHER"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const TUTOR_MODES = ["CONCEPT", "ASSIGNMENT_HELP", "CODE_REVIEW", "DEBUG"] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];

export const WORKSPACE_TYPES = ["STUDY_GROUP", "PROJECT"] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export const THREAD_CONTEXT_TYPES = ["COURSE", "QUIZ", "MATERIAL", "EXAM"] as const;
export type ThreadContextType = (typeof THREAD_CONTEXT_TYPES)[number];

export const SYLLABUS_MILESTONE_TYPES = [
  "FINAL",
  "MIDTERM",
  "EXAM",
  "QUIZ",
  "HOMEWORK",
  "PROJECT",
  "READING",
  "LAB",
  "OFFICE_HOURS",
  "OTHER",
] as const;
export type SyllabusMilestoneType = (typeof SYLLABUS_MILESTONE_TYPES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const QUESTION_TYPES = ["mcq", "short", "code"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Hint tiers for assignment help (Section 6 of the product spec).
// Tier 0 = full generous answer (concept questions only).
export const MAX_HINT_TIER = 4;

// Public discussion boards cap lower than private tutoring: a Tier 4
// structured walkthrough of graded work, visible to the whole class,
// would be answer-dumping by proxy. See buildDiscussionTutorPrompt.
export const DISCUSSION_MAX_TIER = 3;

// Group chat is simple polling on the ChatMessage table (no websockets,
// no paid realtime service - see docs/ARCHITECTURE.md). Clients refetch
// the message list this often.
export const CHAT_POLL_INTERVAL_MS = 3000;

export const TIER_LABELS: Record<number, string> = {
  0: "Full explanation",
  1: "Nudge",
  2: "Guiding question",
  3: "Concept + analogous example",
  4: "Structured walkthrough",
};

// XP awarded per activity (awarded from Phase 1 so the data is already
// there now that the Phase 4 streaks/XP/leaderboard UI ships).
// MATERIAL_UPVOTED goes to the UPLOADER when a classmate upvotes their
// material - it rewards good sharing (the core product loop) without
// touching the uploader's streak (see material.upvote).
export const XP_RULES = {
  MATERIAL_UPLOADED: 25,
  MATERIAL_UPVOTED: 5,
  QUIZ_COMPLETED: 20,
  QUIZ_PERFECT: 15, // bonus on top of QUIZ_COMPLETED
  TUTOR_SESSION: 5,
  STREAK_DAY: 10,
} as const;
export type ActivityType = keyof typeof XP_RULES;

// Human-readable labels for the leaderboard "how you earned XP" breakdown.
export const XP_RULE_LABELS: Record<ActivityType, string> = {
  MATERIAL_UPLOADED: "Materials shared",
  MATERIAL_UPVOTED: "Upvotes received",
  QUIZ_COMPLETED: "Quizzes completed",
  QUIZ_PERFECT: "Perfect quiz scores",
  TUTOR_SESSION: "Tutor sessions",
  STREAK_DAY: "Daily streak days",
};

// Email verification (code-based signup). A 6-digit code, valid 15 minutes.
export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_CODE_TTL_MINUTES = 15;

// Anthropic model used for ALL AI features. Change in one place.
export const AI_MODEL = "claude-sonnet-4-6";

// How much extracted material text we pass as grounding context per call.
// ~60k chars approx ~15k tokens - generous grounding while staying well inside
// the context window even with a long chat history.
export const MAX_GROUNDING_CHARS = 60_000;
export const MAX_CHARS_PER_MATERIAL = 12_000;
