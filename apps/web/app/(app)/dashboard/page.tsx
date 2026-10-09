import Link from "next/link";
import { Code, ListChecks, Sparkles } from "lucide-react";
import { serverApi } from "@/lib/server-api";
import { EmptyState, MaterialTypeBadge, ModeBadge, PageHeader, TierBadge } from "@/components/ui";

const QUICK_ACTIONS = [
  {
    href: "/tutor",
    icon: Sparkles,
    title: "Ask the tutor",
    body: "Concept questions, assignment hints, debugging, and code review.",
  },
  {
    href: "/courses",
    icon: ListChecks,
    title: "Practice a quiz",
    body: "Generate questions from course materials and review weak spots.",
  },
  {
    href: "/code-review",
    icon: Code,
    title: "Review my code",
    body: "Catch bugs and edge cases before you submit.",
  },
];

function formatStudyDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const api = await serverApi();
  const [me, courses, sessions, studyOverview, schoolHub] = await Promise.all([
    api.user.me(),
    api.course.listMine(),
    api.tutor.listSessions(),
    api.study.overview(),
    api.user.schoolHub(),
  ]);
  const priorityCourses = [...studyOverview.courses].sort((a, b) => {
    const score = (course: (typeof studyOverview.courses)[number]) =>
      course.flashcards.due * 3 + course.weakTopics.length * 2 + (course.activePlan?.nextDay ? 4 : 0);
    return score(b) - score(a);
  });

  return (
    <div>
      <PageHeader
        title={`Hey ${me.name.split(" ")[0]}`}
        subtitle="Pick up where you left off, or start a focused study session."
      />

      <section className="surface-panel mb-8 overflow-hidden p-6">
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="eyebrow">Today - {schoolHub.university.name}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Study with your class context in view.</h2>
            <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
              Hyntor recognized your school from {schoolHub.university.emailDomain} and surfaces courses, peers, and materials from that campus graph.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Streak</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{me.streakCount} days</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">XP</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{me.xp}</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Courses</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{courses.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="surface-panel p-6">
          <p className="eyebrow">School graph</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Related to {schoolHub.university.name}.</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
            Courses appear here automatically when classmates with the same school email join or create them.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Students</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{schoolHub.stats.peerCount}</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">School courses</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{schoolHub.stats.courseCount}</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Shared resources</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{schoolHub.stats.resourceCount}</p>
            </div>
          </div>
        </div>

        <div className="surface-panel overflow-hidden">
          <div className="grid divide-y divide-slate-100/80 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-ink">School courses</h3>
                <Link href="/courses" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Browse all
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {schoolHub.courses.slice(0, 4).map((course) => (
                  <Link key={course.id} href={`/courses/${course.id}`} className="block rounded-lg border border-slate-200 bg-white/80 p-3 transition hover:border-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {course.code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {course.joined ? "Joined" : `${course.memberCount} students`}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm font-semibold text-ink">{course.title}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {course.materialCount} materials - {course.quizCount} quizzes
                    </p>
                  </Link>
                ))}
                {schoolHub.courses.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-medium text-slate-500">
                    Be the first to create a course for your school.
                  </p>
                )}
              </div>
            </div>

            <div className="p-5">
              <h3 className="font-display text-lg font-semibold text-ink">Top resources</h3>
              <div className="mt-4 space-y-3">
                {schoolHub.resources.slice(0, 4).map((resource) => (
                  <Link
                    key={resource.id}
                    href={`/materials/${resource.id}`}
                    className="block rounded-lg border border-slate-200 bg-white/80 p-3 transition hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <MaterialTypeBadge type={resource.type} />
                      <span className="font-mono text-[11px] font-semibold text-brand-600">
                        {resource.course.code}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{resource.title}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      by {resource.uploaderName} - {resource.upvoteCount} upvotes
                    </p>
                  </Link>
                ))}
                {schoolHub.resources.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-medium text-slate-500">
                    Shared notes and syllabi from your school will appear here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {priorityCourses.length > 0 && (
        <section className="mb-8 grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="surface-panel p-6">
            <p className="eyebrow">Smart Study</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">What needs attention first.</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Hyntor watches your study plans, review queue, and missed quiz topics across your courses.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="metric-tile">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Cards due</p>
                <p className="mt-1 font-display text-3xl font-semibold text-ink">{studyOverview.totals.dueFlashcards}</p>
              </div>
              <div className="metric-tile">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Weak topics</p>
                <p className="mt-1 font-display text-3xl font-semibold text-ink">{studyOverview.totals.weakTopics}</p>
              </div>
              <div className="metric-tile">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Active plans</p>
                <p className="mt-1 font-display text-3xl font-semibold text-ink">{studyOverview.totals.activePlans}</p>
              </div>
            </div>
          </div>

          <div className="surface-panel divide-y divide-slate-100/80 overflow-hidden">
            {priorityCourses.slice(0, 3).map((course) => {
              const completion =
                course.activePlan && course.activePlan.totalDays > 0
                  ? Math.round((course.activePlan.completedDays / course.activePlan.totalDays) * 100)
                  : 0;
              return (
                <div key={course.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {course.code}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-semibold text-ink">{course.title}</h3>
                    </div>
                    <Link href={`/courses/${course.id}/study`} className="btn-secondary px-3 py-2 text-xs">
                      Open Smart Study
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-400">Review queue</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {course.flashcards.due} due / {course.flashcards.total} total
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-400">Materials</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {course.materialCount} files / {course.quizCount} quizzes
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-400">Next plan day</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {course.activePlan?.nextDay ? formatStudyDate(course.activePlan.nextDay.date) : "No plan yet"}
                      </p>
                    </div>
                  </div>

                  {course.activePlan && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span>Plan progress</span>
                        <span>{completion}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
                      </div>
                      {course.activePlan.nextDay && (
                        <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                          Next: {course.activePlan.nextDay.topics.join(", ")} for {course.activePlan.nextDay.minutes} minutes
                        </p>
                      )}
                    </div>
                  )}

                  {course.weakTopics.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {course.weakTopics.map((topic) => (
                        <span
                          key={topic.topic}
                          className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100"
                        >
                          {topic.topic} x{topic.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="card-interactive block">
            <span className="icon-mark bg-brand-600">
              <action.icon size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="mt-4 font-display font-semibold text-ink">{action.title}</p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">{action.body}</p>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Your courses</h2>
      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Join an existing course or create one, then upload materials so the AI tutor can ground its answers in your class."
          cta="Browse courses"
          href="/courses"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="card-interactive block">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {course.code}
                </span>
                <span className="text-xs font-bold text-slate-400">{course.memberCount} enrolled</span>
              </div>
              <p className="mt-3 font-display text-lg font-semibold text-ink">{course.title}</p>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">{course.description}</p>
              <p className="mt-4 text-xs font-bold text-slate-400">
                {course.materialCount} materials - {course.quizCount} quizzes
              </p>
            </Link>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Recent tutor sessions</h2>
          <div className="surface-panel divide-y divide-slate-100/80 overflow-hidden">
            {sessions.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/tutor/${s.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    {s.courseCode ?? "No course"} - {new Date(s.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ModeBadge mode={s.mode} />
                  {s.mode === "ASSIGNMENT_HELP" && s.tierReached > 0 && <TierBadge tier={s.tierReached} />}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
