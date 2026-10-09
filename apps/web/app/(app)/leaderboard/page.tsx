"use client";

// Phase 4: the leaderboard. Surfaces the XP + streak data collected since
// Phase 1. Scope toggles between the whole school and a single course;
// the current user's own rank and XP breakdown are always shown.
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";

type Board = Awaited<ReturnType<typeof api.leaderboard.get.query>>;
type Course = Awaited<ReturnType<typeof api.course.listMine.query>>[number];
type Entry = Board["entries"][number];

export default function LeaderboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [scope, setScope] = useState<string>(""); // "" = school, else courseId
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setCourses(await api.course.listMine.query());
      } catch {
        // The scope picker just falls back to school-only.
      }
    })();
  }, []);

  const load = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      setBoard(await api.leaderboard.get.query({ courseId: courseId || null }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(scope);
  }, [load, scope]);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Experience points add up every time you learn - share materials, take quizzes, work with the tutor, and keep your streak alive."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="label mb-0">Scope</label>
        <select className="input max-w-xs" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">My whole school</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.title}
            </option>
          ))}
        </select>
        {board && (
          <span className="text-xs font-medium text-slate-500">
            {board.participantCount} student{board.participantCount === 1 ? "" : "s"} in{" "}
            <span className="font-semibold text-slate-700">{board.scopeLabel}</span>
          </span>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {loading && !board ? (
        <p className="py-12 text-center text-sm font-medium text-slate-400">Loading leaderboard...</p>
      ) : (
        board && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="surface-panel divide-y divide-slate-100/80 overflow-hidden">
                {board.entries.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm font-medium text-slate-400">
                    No ranked students yet - be the first to earn XP.
                  </p>
                ) : (
                  board.entries.map((entry) => <RankRow key={entry.userId} entry={entry} />)
                )}
              </div>

              {/* If you're below the visible top slice, show your standing pinned below. */}
              {board.me && board.me.rank > board.entries.length && (
                <>
                  <p className="mb-2 mt-4 text-center text-xs font-medium text-slate-400">your standing</p>
                  <div className="surface-panel overflow-hidden">
                    <RankRow entry={board.me} />
                  </div>
                </>
              )}
            </div>

            <aside className="lg:col-span-1">
              <div className="card">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-400">
                  How you earned your XP
                </h2>
                {board.breakdown.length === 0 ? (
                  <p className="mt-3 text-sm font-medium text-slate-500">
                    No activity yet. Upload a material, take a quiz, or start a tutor session to get on the board.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {board.breakdown.map((b) => (
                      <li key={b.type} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-600">{b.label}</span>
                        <span className="shrink-0 font-semibold text-ink">
                          +{b.points}
                          <span className="ml-1 text-xs font-medium text-slate-400">({b.count})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        )
      )}
    </div>
  );
}

function RankRow({ entry }: { entry: Entry }) {
  const medal = entry.rank <= 3 ? ["1st", "2nd", "3rd"][entry.rank - 1] : `#${entry.rank}`;
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 ${
        entry.isMe ? "bg-brand-50/70" : ""
      }`}
    >
      <span
        className={`grid h-8 w-10 shrink-0 place-items-center rounded-md text-xs font-bold ${
          entry.rank <= 3
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
        }`}
      >
        {medal}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {entry.name}
          {entry.isMe && <span className="ml-2 text-xs font-semibold text-brand-600">you</span>}
          {entry.role !== "STUDENT" && (
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {entry.role}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate-400">
          {entry.streakCount} day streak
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold text-brand-700">{entry.xp} XP</span>
    </div>
  );
}
