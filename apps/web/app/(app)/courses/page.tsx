"use client";

// Courses hub: my courses, browse/search all courses, join, create.
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { CrossUniversityBadge, PageHeader } from "@/components/ui";

type BrowseCourse = Awaited<ReturnType<typeof api.course.browse.query>>[number];
type SchoolHub = Awaited<ReturnType<typeof api.user.schoolHub.query>>;

function CourseCard({ course, onJoin }: { course: BrowseCourse; onJoin: (courseId: string) => void }) {
  return (
    <div className="card-interactive flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-brand-600">
          {course.code}
          {course.schoolMatched && (
            <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-lime-300">
              Your school
            </span>
          )}
          {course.isCrossUniversity && <CrossUniversityBadge />}
        </span>
        <span className="text-right text-xs font-bold text-slate-400">
          {course.memberCount} enrolled - {course.materialCount} materials
        </span>
      </div>
      <p className="mt-3 font-display text-lg font-semibold text-ink">{course.title}</p>
      <p className="mt-1 line-clamp-2 flex-1 text-sm font-medium leading-relaxed text-slate-500">{course.description}</p>
      <div className="mt-5">
        {course.joined ? (
          <Link href={`/courses/${course.id}`} className="btn-secondary w-full">
            Open course
          </Link>
        ) : (
          <button className="btn-primary w-full" onClick={() => onJoin(course.id)}>
            Join course
          </button>
        )}
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<BrowseCourse[]>([]);
  const [schoolHub, setSchoolHub] = useState<SchoolHub | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    subject: "",
    description: "",
    isCrossUniversity: false,
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const [nextCourses, nextSchoolHub] = await Promise.all([
        api.course.browse.query({ query: q || undefined }),
        api.user.schoolHub.query(),
      ]);
      setCourses(nextCourses);
      setSchoolHub(nextSchoolHub);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const schoolCourses = useMemo(() => courses.filter((course) => course.schoolMatched), [courses]);
  const globalCourses = useMemo(() => courses.filter((course) => !course.schoolMatched), [courses]);

  async function handleJoin(courseId: string) {
    try {
      await api.course.join.mutate({ courseId });
      router.push(`/courses/${courseId}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api.course.create.mutate(form);
      router.push(`/courses/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle={
          schoolHub
            ? `Recognized ${schoolHub.university.name} from your school email. Related courses appear first.`
            : "Join your class, or be the first to create it."
        }
        action={
          <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "Create course"}
          </button>
        }
      />

      {schoolHub && (
        <section className="surface-panel mb-6 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">School match</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">{schoolHub.university.name}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {schoolHub.stats.courseCount} school course{schoolHub.stats.courseCount === 1 ? "" : "s"},{" "}
                {schoolHub.stats.resourceCount} shared resource{schoolHub.stats.resourceCount === 1 ? "" : "s"}, and{" "}
                {schoolHub.stats.peerCount} student{schoolHub.stats.peerCount === 1 ? "" : "s"} on this school graph.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500 sm:min-w-80">
              <span className="rounded-lg bg-white px-3 py-2 shadow-sm">{schoolHub.stats.courseCount} courses</span>
              <span className="rounded-lg bg-white px-3 py-2 shadow-sm">{schoolHub.stats.resourceCount} resources</span>
              <span className="rounded-lg bg-white px-3 py-2 shadow-sm">{schoolHub.stats.peerCount} peers</span>
            </div>
          </div>
        </section>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-8 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Course code</label>
            <input
              className="input"
              placeholder="CS201"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              placeholder="Computer Science"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="Data Structures and Algorithms"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-600 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-600"
              checked={form.isCrossUniversity}
              onChange={(e) => setForm({ ...form, isCrossUniversity: e.target.checked })}
            />
            <span>
              <strong className="text-ink">Cross-university course.</strong> Students from any university can discover and join it.
            </span>
          </label>
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
            {busy ? "Creating..." : "Create and join"}
          </button>
        </form>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="input"
          placeholder="Search by code, title, or subject..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
        />
        <button className="btn-secondary shrink-0" onClick={() => load(query)}>
          Search
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-sm font-medium text-slate-400">Loading courses...</p>
      ) : courses.length === 0 ? (
        <p className="py-12 text-center text-sm font-medium text-slate-400">
          No courses found. Create the first one for your class.
        </p>
      ) : (
        <div className="space-y-8">
          {schoolCourses.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Your school</p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-ink">Courses from classmates</h2>
                </div>
                <p className="text-xs font-semibold text-slate-400">{schoolCourses.length} match{schoolCourses.length === 1 ? "" : "es"}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {schoolCourses.map((course) => (
                  <CourseCard key={course.id} course={course} onJoin={handleJoin} />
                ))}
              </div>
            </section>
          )}

          {globalCourses.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Open network</p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-ink">Cross-university courses</h2>
                </div>
                <p className="text-xs font-semibold text-slate-400">{globalCourses.length} open</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {globalCourses.map((course) => (
                  <CourseCard key={course.id} course={course} onJoin={handleJoin} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
