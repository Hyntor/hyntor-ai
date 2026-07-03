"use client";

// Tutor hub: start a new session or resume one.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { MODE_META, ModeBadge, PageHeader, TierBadge } from "@/components/ui";

type Course = Awaited<ReturnType<typeof api.course.listMine.query>>[number];
type Session = Awaited<ReturnType<typeof api.tutor.listSessions.query>>[number];

function TutorHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mode, setMode] = useState<string>("CONCEPT");
  const [courseId, setCourseId] = useState<string>(searchParams.get("courseId") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [myCourses, mySessions] = await Promise.all([
          api.course.listMine.query(),
          api.tutor.listSessions.query(),
        ]);
        setCourses(myCourses);
        setSessions(mySessions);
        setCourseId((current) => current || (myCourses[0]?.id ?? ""));
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.tutor.createSession.mutate({
        mode: mode as "CONCEPT" | "ASSIGNMENT_HELP" | "CODE_REVIEW" | "DEBUG",
        courseId: courseId || null,
      });
      router.push(`/tutor/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Tutor"
        subtitle="A focused study room that reads your shared course materials before it answers."
        action={
          <Link href="/courses" className="btn-secondary">
            Browse courses
          </Link>
        }
      />

      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="card overflow-hidden">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">New session</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Choose how you want help.</h2>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              Course-grounded
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(MODE_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`group rounded-lg border p-4 text-left transition ${
                  mode === key
                    ? "border-brand-300 bg-brand-50 shadow-card"
                    : "border-slate-200/80 bg-white/70 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                }`}
              >
                <span
                  className={`mb-4 grid h-9 w-9 place-items-center rounded-lg ${
                    mode === key ? "bg-ink text-white" : "bg-slate-100 text-brand-700 group-hover:bg-ink group-hover:text-white"
                  }`}
                >
                  <meta.icon size={17} strokeWidth={2} aria-hidden="true" />
                </span>
                <p className="font-display font-semibold text-ink">{meta.label}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{meta.blurb}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <label className="label">Course context</label>
              <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">No course - general tutoring</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={startSession} disabled={busy} className="btn-primary w-full lg:w-auto">
              {busy ? "Starting..." : "Start session"}
            </button>
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </div>

        <aside className="surface-panel p-6">
          <p className="eyebrow">How it protects learning</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Useful help without answer dumping.</h2>
          <div className="mt-6 grid gap-3">
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Materials</p>
              <p className="mt-1 text-sm font-semibold text-ink">Uses the slides, homework, notes, and tests your class shares.</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Assignments</p>
              <p className="mt-1 text-sm font-semibold text-ink">Escalates from hints to walkthroughs only as you engage.</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Code</p>
              <p className="mt-1 text-sm font-semibold text-ink">Finds bugs and edge cases with questions, not rewrites.</p>
            </div>
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Past sessions</h2>
          <span className="text-xs font-bold text-slate-400">{sessions.length} total</span>
        </div>
        {sessions.length === 0 ? (
          <p className="card text-sm font-medium text-slate-500">No sessions yet. Start your first one above.</p>
        ) : (
          <div className="surface-panel divide-y divide-slate-100/80 overflow-hidden">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/tutor/${s.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    {s.courseCode ?? "No course"} - {new Date(s.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ModeBadge mode={s.mode} />
                  {s.mode === "ASSIGNMENT_HELP" && s.tierReached > 0 && <TierBadge tier={s.tierReached} />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense>
      <TutorHub />
    </Suspense>
  );
}
