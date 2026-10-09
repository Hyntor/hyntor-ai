"use client";

// Pre-submit code review: paste homework code, get pointed questions.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";

type Course = Awaited<ReturnType<typeof api.course.listMine.query>>[number];

export default function CodeReviewPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [context, setContext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.course.listMine
      .query()
      .then((mine) => {
        setCourses(mine);
        setCourseId(mine[0]?.id ?? "");
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.tutor.createSession.mutate({
        mode: "CODE_REVIEW",
        courseId: courseId || null,
      });
      const firstMessage = `${context.trim() ? `What this code should do: ${context.trim()}\n\n` : ""}\`\`\`\n${code}\n\`\`\``;
      await api.tutor.sendMessage.mutate({ sessionId: id, content: firstMessage });
      router.push(`/tutor/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Pre-submit code review"
        subtitle="Paste homework code before turning it in. You get pointed questions about bugs, edge cases, and style without rewritten answers."
      />
      <div className="grid gap-6 lg:grid-cols-[0.95fr_0.55fr]">
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Course context</label>
            <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">What should this code do?</label>
            <input
              className="input"
              placeholder="Example: Insert a key into a hash table with linear probing"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Your code</label>
            <textarea
              className="input min-h-80 font-mono text-xs"
              rows={16}
              required
              placeholder="Paste your code here..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          <button type="submit" disabled={busy || !code.trim()} className="btn-primary">
            {busy ? "Reviewing... (~20s)" : "Review my code"}
          </button>
        </form>

        <aside className="surface-panel h-fit p-6">
          <p className="eyebrow">Review style</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Find the bug. Own the fix.</h2>
          <div className="mt-6 space-y-3 text-sm font-medium leading-relaxed text-slate-500">
            <p>The tutor reads your course context when available.</p>
            <p>It calls out edge cases, assumptions, and style risks.</p>
            <p>It asks the question that gets you to the next step instead of rewriting the answer.</p>
          </div>
          <p className="mt-6 border-t border-slate-200 pt-4 text-sm font-medium text-slate-500">
            Want to run it first?{" "}
            <Link href="/sandbox" className="font-semibold text-brand-600 hover:text-brand-700">
              Try the code sandbox
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
