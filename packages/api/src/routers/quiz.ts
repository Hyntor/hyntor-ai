import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  buildMockExamPrompt,
  buildQuizGenerationPrompt,
  buildGradingPrompt,
  extractJson,
  parseJsonColumn,
  QuizQuestionsSchema,
  AttemptAnswersSchema,
  type QuizQuestion,
  type AttemptAnswer,
} from "@coursemind/core";
import { router, protectedProcedure, requireEnrollment } from "../trpc";
import { askClaude, isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "../ai";
import { recordActivity } from "../activity";
import { gatherGrounding } from "../grounding";

const SELF_CHECK_FEEDBACK =
  "AI grading isn't configured, so this answer wasn't auto-graded. Compare your answer with the sample answer below and grade yourself honestly.";

export const quizRouter = router({
  /** Generate ~N questions from one material, in the professor's style. */
  generate: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        materialId: z.string(),
        questionCount: z.number().int().min(4).max(20).default(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      if (!isAiConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: AI_NOT_CONFIGURED_MESSAGE });
      }
      const material = await ctx.prisma.material.findUniqueOrThrow({
        where: { id: input.materialId },
      });
      if (material.courseId !== input.courseId) throw new TRPCError({ code: "BAD_REQUEST" });
      if (!material.extractedText) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This material has no extracted text to generate questions from (it may be a scanned PDF). Pick another material or paste the text in as notes.",
        });
      }

      const raw = await askClaude({
        system:
          "You are an expert university exam writer. You respond with ONLY valid JSON - no prose, no markdown fences.",
        messages: [
          {
            role: "user",
            content: buildQuizGenerationPrompt({
              materialTitle: material.title,
              materialText: material.extractedText.slice(0, 48_000),
              questionCount: input.questionCount,
            }),
          },
        ],
        maxTokens: 8192,
      });

      const parsed = QuizQuestionsSchema.safeParse(extractJson(raw));
      if (!parsed.success || parsed.data.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The AI returned an unexpected quiz format. Please try generating again.",
        });
      }
      // Ensure stable unique ids regardless of what the model produced.
      const questions = parsed.data.map((q, i) => ({ ...q, id: `q${i + 1}` }));

      const quiz = await ctx.prisma.quiz.create({
        data: {
          courseId: input.courseId,
          sourceMaterialId: material.id,
          creatorId: null, // AI-generated
          title: `${material.title} - Practice Quiz`,
          questions: JSON.stringify(questions),
        },
      });
      return { id: quiz.id, questionCount: questions.length };
    }),

  /** Quiz for TAKING - answers/explanations stripped so they can't leak. */
  /** Generate a timed mock exam across the whole course library. */
  generateMockExam: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        questionCount: z.number().int().min(8).max(30).default(14),
        timeLimit: z.number().int().min(20).max(240).default(75),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireEnrollment(ctx.userId, input.courseId);
      if (!isAiConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: AI_NOT_CONFIGURED_MESSAGE });
      }

      const course = await ctx.prisma.course.findUniqueOrThrow({
        where: { id: input.courseId },
        select: { code: true, title: true },
      });
      const materials = await gatherGrounding(ctx.prisma, input.courseId);
      if (materials.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This course has no readable materials yet. Upload notes, slides, homework prompts, tests, or a syllabus before generating a mock exam.",
        });
      }

      const raw = await askClaude({
        system:
          "You are an expert university exam writer. You respond with ONLY valid JSON - no prose, no markdown fences.",
        messages: [
          {
            role: "user",
            content: buildMockExamPrompt({
              courseTitle: `${course.code} - ${course.title}`,
              materials,
              questionCount: input.questionCount,
            }),
          },
        ],
        maxTokens: 8192,
      });

      const parsed = QuizQuestionsSchema.safeParse(extractJson(raw));
      if (!parsed.success || parsed.data.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The AI returned an unexpected mock exam format. Please try again.",
        });
      }
      const questions = parsed.data.map((q, i) => ({ ...q, id: `q${i + 1}` }));

      const quiz = await ctx.prisma.quiz.create({
        data: {
          courseId: input.courseId,
          creatorId: null,
          title: `${course.code} Mock Exam - ${new Date().toLocaleDateString("en-US")}`,
          questions: JSON.stringify(questions),
          isMockExam: true,
          timeLimit: input.timeLimit,
        },
      });
      return { id: quiz.id, questionCount: questions.length };
    }),

  get: protectedProcedure
    .input(z.object({ quizId: z.string() }))
    .query(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.quiz.findUniqueOrThrow({ where: { id: input.quizId } });
      await requireEnrollment(ctx.userId, quiz.courseId);
      const questions = parseJsonColumn<QuizQuestion[]>(quiz.questions, QuizQuestionsSchema, []);
      return {
        id: quiz.id,
        title: quiz.title,
        courseId: quiz.courseId,
        timeLimit: quiz.timeLimit,
        isMockExam: quiz.isMockExam,
        questions: questions.map((q) => ({
          id: q.id,
          type: q.type,
          topic: q.topic,
          prompt: q.prompt,
          options: q.options,
        })),
      };
    }),

  submit: protectedProcedure
    .input(
      z.object({
        quizId: z.string(),
        answers: z.array(z.object({ questionId: z.string(), response: z.string() })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.quiz.findUniqueOrThrow({ where: { id: input.quizId } });
      await requireEnrollment(ctx.userId, quiz.courseId);
      const questions = parseJsonColumn<QuizQuestion[]>(quiz.questions, QuizQuestionsSchema, []);
      const responseByQuestion = new Map(input.answers.map((a) => [a.questionId, a.response]));

      const graded: AttemptAnswer[] = await Promise.all(
        questions.map(async (q): Promise<AttemptAnswer> => {
          const response = (responseByQuestion.get(q.id) ?? "").trim();
          if (!response) {
            return { questionId: q.id, response, correct: false, feedback: "No answer given." };
          }
          if (q.type === "mcq") {
            const correct = Number(response) === q.correctOption;
            return {
              questionId: q.id,
              response,
              correct,
              feedback: correct ? "Correct!" : "Not quite - see the explanation below.",
            };
          }
          // short / code -> AI-graded when possible, honest self-check otherwise
          if (!isAiConfigured()) {
            return { questionId: q.id, response, correct: null, feedback: SELF_CHECK_FEEDBACK };
          }
          try {
            const raw = await askClaude({
              system: "You are a fair university grader. Respond with ONLY valid JSON.",
              messages: [{ role: "user", content: buildGradingPrompt({ question: q, studentResponse: response }) }],
              maxTokens: 512,
            });
            const result = extractJson(raw) as { correct?: boolean; feedback?: string } | null;
            if (result && typeof result.correct === "boolean") {
              return {
                questionId: q.id,
                response,
                correct: result.correct,
                feedback: result.feedback ?? "",
              };
            }
          } catch {
            // fall through to self-check below
          }
          return { questionId: q.id, response, correct: null, feedback: SELF_CHECK_FEEDBACK };
        })
      );

      const gradable = graded.filter((g) => g.correct !== null);
      const score =
        gradable.length === 0
          ? 0
          : Math.round((gradable.filter((g) => g.correct).length / gradable.length) * 100);
      const topicByQuestion = new Map(questions.map((q) => [q.id, q.topic]));
      const weakTopics = [
        ...new Set(
          graded
            .filter((g) => g.correct === false)
            .map((g) => topicByQuestion.get(g.questionId) ?? "general")
        ),
      ];

      const attempt = await ctx.prisma.quizAttempt.create({
        data: {
          userId: ctx.userId,
          quizId: quiz.id,
          answers: JSON.stringify(graded),
          score,
          weakTopics: JSON.stringify(weakTopics),
        },
      });
      await recordActivity(ctx.userId, "QUIZ_COMPLETED");
      if (score === 100) await recordActivity(ctx.userId, "QUIZ_PERFECT");

      return { attemptId: attempt.id, score };
    }),

  /** Full review payload: questions WITH answers/explanations + grading. */
  attempt: protectedProcedure
    .input(z.object({ attemptId: z.string() }))
    .query(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.quizAttempt.findUniqueOrThrow({
        where: { id: input.attemptId },
        include: { quiz: true },
      });
      if (attempt.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const questions = parseJsonColumn<QuizQuestion[]>(
        attempt.quiz.questions,
        QuizQuestionsSchema,
        []
      );
      const answers = parseJsonColumn<AttemptAnswer[]>(attempt.answers, AttemptAnswersSchema, []);
      const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
      return {
        id: attempt.id,
        score: attempt.score,
        createdAt: attempt.createdAt,
        quizId: attempt.quizId,
        quizTitle: attempt.quiz.title,
        courseId: attempt.quiz.courseId,
        weakTopics: parseJsonColumn<string[]>(attempt.weakTopics, z.array(z.string()), []),
        review: questions.map((q) => ({
          question: q, // includes options, correctOption, sampleAnswer, explanation
          answer: answerByQuestion.get(q.id) ?? null,
        })),
      };
    }),

  myAttempts: protectedProcedure
    .input(z.object({ quizId: z.string() }))
    .query(async ({ ctx, input }) => {
      const attempts = await ctx.prisma.quizAttempt.findMany({
        where: { userId: ctx.userId, quizId: input.quizId },
        orderBy: { createdAt: "desc" },
        select: { id: true, score: true, createdAt: true },
      });
      return attempts;
    }),
});
