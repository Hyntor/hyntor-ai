"use client";

// Smart-study hub for one course.
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { EmptyState, PageHeader } from "@/components/ui";

type Dashboard = Awaited<ReturnType<typeof api.study.courseDashboard.query>>;
type DueCard = Awaited<ReturnType<typeof api.flashcard.due.query>>[number];
type SyllabusImportResult = Awaited<ReturnType<typeof api.study.importSyllabus.mutate>>;

const RATING_LABELS = {
  AGAIN: "Again",
  HARD: "Hard",
  GOOD: "Good",
  EASY: "Easy",
} as const;

export default function SmartStudyPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [examDate, setExamDate] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [syllabusTitle, setSyllabusTitle] = useState("Course syllabus");
  const [syllabusText, setSyllabusText] = useState("");
  const [autopilot, setAutopilot] = useState<SyllabusImportResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dashboard, cards] = await Promise.all([
        api.study.courseDashboard.query({ courseId }),
        api.flashcard.due.query({ courseId, limit: 10 }),
      ]);
      setData(dashboard);
      setDueCards(cards);
      setSelectedMaterialId((current) => current || dashboard.materials.find((m) => m.hasText)?.id || "");
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentCard = dueCards[0] ?? null;
  const plan = data?.plans[0] ?? null;
  const readableMaterials = useMemo(
    () => data?.materials.filter((material) => material.hasText) ?? [],
    [data?.materials]
  );
  const planStats = useMemo(() => {
    if (!plan) return null;
    const completedDays = plan.schedule.filter((day) => day.done).length;
    const totalDays = plan.schedule.length;
    const completion = totalDays === 0 ? 0 : Math.round((completedDays / totalDays) * 100);
    const nextDay =
      plan.schedule
        .filter((day) => !day.done)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    const remainingMinutes = plan.schedule
      .filter((day) => !day.done)
      .reduce((sum, day) => sum + day.minutes, 0);
    return { completedDays, totalDays, completion, nextDay, remainingMinutes };
  }, [plan]);
  const maxWeakCount = useMemo(
    () => Math.max(1, ...(data?.weakTopics.map((topic) => topic.count) ?? [])),
    [data?.weakTopics]
  );
  const totalWeakMisses = useMemo(
    () => data?.weakTopics.reduce((sum, topic) => sum + topic.count, 0) ?? 0,
    [data?.weakTopics]
  );
  const upcomingDeadlines = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (data?.deadlines ?? []).filter((deadline) => deadline.date >= today).slice(0, 6);
  }, [data?.deadlines]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const selectedExamDate = String(form.get("examDate") || examDate);
    if (!selectedExamDate) return;
    setBusy("plan");
    setError(null);
    setNotice(null);
    try {
      await api.study.createPlan.mutate({ courseId, examDate: selectedExamDate });
      setNotice("Study plan created.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function importSyllabus(e: React.FormEvent) {
    e.preventDefault();
    if (syllabusText.trim().length < 80) return;
    setBusy("syllabus");
    setError(null);
    setNotice(null);
    try {
      const result = await api.study.importSyllabus.mutate({
        courseId,
        title: syllabusTitle.trim() || "Course syllabus",
        text: syllabusText,
      });
      setAutopilot(result);
      setSyllabusText("");
      setNotice(
        result.milestones.length > 0
          ? `Syllabus autopilot added ${result.milestones.length} dates and ${result.schedule.length} study blocks.`
          : "Syllabus saved. No dated milestones were found yet."
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function togglePlanDay(planId: string, date: string, done: boolean) {
    setBusy(`day:${date}`);
    try {
      await api.study.toggleDay.mutate({ planId, date, done });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function generateFlashcards() {
    if (!selectedMaterialId) return;
    setBusy("flashcards");
    setNotice(null);
    setError(null);
    try {
      const result = await api.flashcard.generate.mutate({
        courseId,
        materialId: selectedMaterialId,
        cardCount: 12,
      });
      setNotice(`${result.count} flashcards added to your review queue.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reviewFlashcard(rating: keyof typeof RATING_LABELS) {
    if (!currentCard) return;
    setBusy(`review:${rating}`);
    try {
      await api.flashcard.review.mutate({ flashcardId: currentCard.id, rating });
      setDueCards((cards) => cards.slice(1));
      setRevealed(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function generateMockExam() {
    setBusy("mock");
    setNotice(null);
    setError(null);
    try {
      const { id } = await api.quiz.generateMockExam.mutate({
        courseId,
        questionCount: 14,
        timeLimit: 75,
      });
      router.push(`/quizzes/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  if (!data && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading smart study tools...</p>;
  }

  return (
    <div>
      <PageHeader
        title="Smart study"
        subtitle={data ? `${data.course.code} - ${data.course.title}` : "Study planning"}
        action={
          <Link href={`/courses/${courseId}`} className="btn-secondary">
            Back to course
          </Link>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{notice}</p>}

      {data && (
        <>
        <section className="mb-6 overflow-hidden rounded-lg border border-slate-200/70 bg-white/90 shadow-card backdrop-blur-xl">
          <div className="grid lg:grid-cols-[1fr_0.78fr]">
            <form onSubmit={importSyllabus} className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Syllabus autopilot</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Drop in the syllabus. Get the semester map.</h2>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  Calendar-ready
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <label className="label">Title</label>
                  <input
                    className="input"
                    value={syllabusTitle}
                    onChange={(e) => setSyllabusTitle(e.target.value)}
                    placeholder="CS201 Fall syllabus"
                    required
                  />
                </div>
                <div>
                  <label className="label">Quick signal</label>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
                    <div className="rounded-lg bg-slate-50 px-2 py-2">Deadlines</div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">Workbacks</div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">Review days</div>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Syllabus text</label>
                <textarea
                  className="input min-h-44 font-mono text-xs leading-relaxed"
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  minLength={80}
                  required
                  placeholder="Paste the course schedule, grading table, homework due dates, quiz dates, and exam dates..."
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy === "syllabus" || syllabusText.trim().length < 80}
                >
                  {busy === "syllabus" ? "Scanning syllabus..." : "Build semester map"}
                </button>
                <p className="text-xs font-medium text-slate-400">
                  The syllabus is saved as a shared course material.
                </p>
              </div>
            </form>

            <div className="border-t border-slate-200 bg-ink p-6 text-white lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-300">Autopilot output</p>
              {autopilot ? (
                <div className="mt-5 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/10 p-3">
                      <p className="text-[11px] font-semibold text-slate-300">Dates</p>
                      <p className="mt-1 font-display text-2xl font-semibold">{autopilot.milestones.length}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-3">
                      <p className="text-[11px] font-semibold text-slate-300">Blocks</p>
                      <p className="mt-1 font-display text-2xl font-semibold">{autopilot.schedule.length}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-3">
                      <p className="text-[11px] font-semibold text-slate-300">Next</p>
                      <p className="mt-1 text-sm font-semibold">
                        {autopilot.milestones[0]?.date ?? "None"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {autopilot.milestones.slice(0, 4).map((milestone) => (
                      <div key={milestone.id} className="rounded-lg bg-white/10 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{milestone.title}</p>
                          <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                            {milestone.type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-300">{milestone.date}</p>
                      </div>
                    ))}
                    {autopilot.milestones.length === 0 && (
                      <p className="rounded-lg bg-white/10 px-3 py-3 text-sm font-medium text-slate-300">
                        Saved to the library. Add clearer dated schedule lines for automatic planning.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg bg-white/10 p-4">
                    <p className="font-display text-xl font-semibold">Semester radar</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
                      Exams, projects, quizzes, labs, readings, and homework dates become a live Smart Study plan.
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs font-semibold text-slate-300 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <span className="rounded-lg bg-white/10 px-3 py-2">Due-date timeline</span>
                    <span className="rounded-lg bg-white/10 px-3 py-2">Exam workbacks</span>
                    <span className="rounded-lg bg-white/10 px-3 py-2">Project checkpoints</span>
                    <span className="rounded-lg bg-white/10 px-3 py-2">Review reminders</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <div className="card">
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Exam prep</p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-ink">Study plan</h2>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                    Schedule review around course materials, syllabus text, and missed quiz topics.
                  </p>
                </div>
                <form onSubmit={createPlan} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    name="examDate"
                    type="date"
                    className="input sm:w-40"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={busy === "plan"} className="btn-primary">
                    {busy === "plan" ? "Planning..." : "Create plan"}
                  </button>
                </form>
              </div>

              {plan ? (
                <div>
                  <p className="mb-3 text-sm font-medium text-slate-500">
                    Latest plan for {new Date(plan.examDate).toLocaleDateString()}.
                  </p>
                  {plan.schedule.length > 0 ? (
                    <div className="space-y-2">
                    {plan.schedule.map((day, index) => {
                      const isDeadline = day.kind === "deadline";
                      return (
                      <label
                        key={`${day.date}-${index}`}
                        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                          isDeadline
                            ? "border-amber-200 bg-amber-50"
                            : day.done
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-white/75"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-brand-600"
                          checked={day.done}
                          disabled={busy === `day:${day.date}`}
                          onChange={(e) => togglePlanDay(plan.id, day.date, e.target.checked)}
                        />
                        <span className="min-w-28 font-mono text-xs font-semibold text-slate-500">
                          {day.date}
                        </span>
                        <span className="flex-1">
                          <span className="font-semibold text-ink">{day.topics.join(", ")}</span>
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            {isDeadline ? "Deadline" : `${day.minutes} min`}
                          </span>
                        </span>
                      </label>
                      );
                    })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-medium text-slate-500">
                      This plan has no schedule rows yet.
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No plan yet"
                  body="Pick an exam date and Hyntor will turn your shared course context into a realistic study schedule."
                />
              )}
            </div>

            <div className="card">
              <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="eyebrow">Memory</p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-ink">Flashcards</h2>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                    Generate cards from shared materials, then review due cards with spaced repetition.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="input sm:w-64"
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    disabled={readableMaterials.length === 0}
                  >
                    {readableMaterials.length === 0 ? (
                      <option>No readable materials</option>
                    ) : (
                      readableMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.title}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={generateFlashcards}
                    disabled={busy === "flashcards" || !selectedMaterialId}
                  >
                    {busy === "flashcards" ? "Generating..." : "Generate 12 cards"}
                  </button>
                </div>
              </div>

              {currentCard ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Due now
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-display text-xl font-semibold text-ink">
                    {currentCard.front}
                  </p>
                  {revealed ? (
                    <>
                      <p className="mt-4 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
                        {currentCard.back}
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {Object.entries(RATING_LABELS).map(([rating, label]) => (
                          <button
                            key={rating}
                            className="btn-secondary"
                            disabled={busy === `review:${rating}`}
                            onClick={() => reviewFlashcard(rating as keyof typeof RATING_LABELS)}
                          >
                            {label} - {currentCard.previews[rating as keyof typeof RATING_LABELS]}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button type="button" className="btn-primary mt-4" onClick={() => setRevealed(true)}>
                      Reveal answer
                    </button>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-medium text-slate-500">
                  No cards due right now. Generate cards from a material to start reviewing.
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="card">
              <p className="eyebrow">Syllabus timeline</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">Upcoming dates</h2>
              {upcomingDeadlines.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {upcomingDeadlines.map((deadline) => (
                    <div key={`${deadline.date}-${deadline.title}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ink">{deadline.title}</p>
                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                          {deadline.type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-brand-700">
                        {new Date(`${deadline.date}T12:00:00.000Z`).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                  Paste a syllabus to populate the course calendar.
                </p>
              )}
            </div>

            <div className="card">
              <p className="eyebrow">Readiness</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">Course pulse</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                    <span>Study plan progress</span>
                    <span>{planStats ? `${planStats.completion}%` : "No plan"}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label="Study plan progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={planStats?.completion ?? 0}
                  >
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${planStats?.completion ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-400">Next study block</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {planStats?.nextDay
                        ? `${new Date(planStats.nextDay.date).toLocaleDateString()} - ${planStats.nextDay.minutes} min`
                        : "Create a plan"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-400">Review pressure</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {data.flashcards.due} due of {data.flashcards.total}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-400">Weak-topic misses</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{totalWeakMisses}</p>
                  </div>
                </div>

                {planStats?.nextDay && (
                  <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium leading-relaxed text-brand-800">
                    Next: {planStats.nextDay.topics.join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <p className="eyebrow">Focus</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">Weak topic radar</h2>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                    Ranked by missed quiz topics so review starts where it matters most.
                  </p>
                </div>
                {data.weakTopics.length > 0 && (
                  <Link href={`/tutor?courseId=${courseId}`} className="btn-secondary px-3 py-2 text-xs">
                    Review with tutor
                  </Link>
                )}
              </div>
              {data.weakTopics.length === 0 ? (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                  Missed quiz topics will show up here after you take practice quizzes.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {data.weakTopics.slice(0, 8).map((topic) => (
                    <div key={topic.topic}>
                      <div className="mb-1.5 flex justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-700">{topic.topic}</span>
                        <span className="font-medium text-slate-400">
                          {topic.count} miss{topic.count === 1 ? "" : "es"}
                        </span>
                      </div>
                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label={`${topic.topic} weak-topic misses`}
                        aria-valuemin={0}
                        aria-valuemax={maxWeakCount}
                        aria-valuenow={topic.count}
                      >
                        <div
                          className="h-full rounded-full bg-coral-400"
                          style={{ width: `${Math.max(14, Math.round((topic.count / maxWeakCount) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Best next move
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">
                      Review {data.weakTopics[0]?.topic}, then take a short practice quiz to see if it drops from the radar.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <p className="eyebrow">Timed practice</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">Mock exam</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                Generate a timed exam across the whole shared course library.
              </p>
              <button
                type="button"
                className="btn-primary mt-4 w-full"
                onClick={generateMockExam}
                disabled={busy === "mock"}
              >
                {busy === "mock" ? "Generating exam..." : "Generate mock exam"}
              </button>
            </div>

            <div className="card">
              <p className="eyebrow">Review queue</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="metric-tile">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Due</dt>
                  <dd className="font-display text-2xl font-semibold text-ink">{data.flashcards.due}</dd>
                </div>
                <div className="metric-tile">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</dt>
                  <dd className="font-display text-2xl font-semibold text-ink">{data.flashcards.total}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
        </>
      )}
    </div>
  );
}
