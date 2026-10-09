"use client";

// Take a quiz. Answers and explanations stay server-side until review.
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";

type QuizPayload = Awaited<ReturnType<typeof api.quiz.get.query>>;
type Attempt = Awaited<ReturnType<typeof api.quiz.myAttempts.query>>[number];

export default function TakeQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [quizData, myAttempts] = await Promise.all([
          api.quiz.get.query({ quizId }),
          api.quiz.myAttempts.query({ quizId }),
        ]);
        setQuiz(quizData);
        setAttempts(myAttempts);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [quizId]);

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      const payload = quiz.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? "",
      }));
      const { attemptId } = await api.quiz.submit.mutate({ quizId, answers: payload });
      router.push(`/quizzes/attempts/${attemptId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!quiz && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading quiz...</p>;
  }
  if (error && !quiz) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  const answeredCount = quiz!.questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  return (
    <div>
      <PageHeader
        title={quiz!.title}
        subtitle={`${quiz!.questions.length} questions - grading includes AI feedback on written answers`}
        action={
          <Link href={`/courses/${quiz!.courseId}`} className="btn-secondary">
            Back to course
          </Link>
        }
      />

      {attempts.length > 0 && (
        <p className="mb-6 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-800">
          You have taken this quiz {attempts.length} time{attempts.length === 1 ? "" : "s"} with a best score of{" "}
          {Math.max(...attempts.map((a) => a.score))}%.{" "}
          <Link href={`/quizzes/attempts/${attempts[0].id}`} className="font-semibold underline">
            Review your last attempt
          </Link>
        </p>
      )}

      <div className="space-y-6">
        {quiz!.questions.map((question, index) => (
          <div key={question.id} className="card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Question {index + 1} - {question.topic}
            </p>
            <p className="whitespace-pre-wrap font-semibold text-ink">{question.prompt}</p>
            {question.type === "mcq" && question.options ? (
              <div className="mt-4 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <label
                    key={optionIndex}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      answers[question.id] === String(optionIndex)
                        ? "border-brand-300 bg-brand-50 text-brand-800 shadow-card"
                        : "border-slate-200 bg-white/60 hover:border-brand-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      className="mt-0.5 accent-brand-600"
                      checked={answers[question.id] === String(optionIndex)}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [question.id]: String(optionIndex) }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className={`input mt-4 ${question.type === "code" ? "font-mono text-xs" : ""}`}
                rows={question.type === "code" ? 8 : 4}
                placeholder={question.type === "code" ? "Write your code here..." : "Your answer..."}
                value={answers[question.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-4 rounded-lg border border-white/70 bg-white/90 px-5 py-4 shadow-lift backdrop-blur">
        <p className="text-sm font-bold text-slate-500">
          {answeredCount}/{quiz!.questions.length} answered
        </p>
        <button onClick={submit} disabled={busy} className="btn-primary">
          {busy ? "Grading... (~15s)" : "Submit and grade"}
        </button>
      </div>
    </div>
  );
}
