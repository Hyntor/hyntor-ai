"use client";

// Workspaces hub for a course: study groups and project teams.
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { EmptyState, PageHeader, WORKSPACE_TYPE_META, WorkspaceTypeBadge } from "@/components/ui";

type Payload = Awaited<ReturnType<typeof api.workspace.listByCourse.query>>;

export default function WorkspacesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "STUDY_GROUP", description: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.workspace.listByCourse.query({ courseId }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api.workspace.create.mutate({
        courseId,
        name: form.name,
        type: form.type as "STUDY_GROUP" | "PROJECT",
        description: form.description,
      });
      router.push(`/workspaces/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleJoin(workspaceId: string) {
    try {
      await api.workspace.join.mutate({ workspaceId });
      router.push(`/workspaces/${workspaceId}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!data && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading workspaces...</p>;
  }

  return (
    <div>
      <PageHeader
        title="Workspaces"
        subtitle={
          data ? `${data.course.code} - study groups and project teams` : "Study groups and project teams"
        }
        action={
          <div className="flex flex-wrap gap-3">
            <Link href={`/courses/${courseId}`} className="btn-secondary">
              Back to course
            </Link>
            <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "New workspace"}
            </button>
          </div>
        }
      />

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-8 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            {Object.entries(WORKSPACE_TYPE_META).map(([key, meta]) => (
              <button
                type="button"
                key={key}
                onClick={() => setForm({ ...form, type: key })}
                className={`rounded-lg border p-4 text-left transition ${
                  form.type === key
                    ? "border-brand-300 bg-brand-50 shadow-card"
                    : "border-slate-200/80 bg-white/70 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                }`}
              >
                <span className="icon-mark mb-4 bg-slate-100 text-brand-700">
                  <meta.icon size={16} strokeWidth={2} aria-hidden="true" />
                </span>
                <p className="font-display font-semibold text-ink">{meta.label}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {key === "STUDY_GROUP"
                    ? "Study together with a shared board and group chat."
                    : "Ship a group project with tasks, assignments, and chat."}
                </p>
              </button>
            ))}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input
              className="input"
              placeholder={form.type === "PROJECT" ? "Final project team" : "Tuesday study crew"}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">What is it about? (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
            {busy ? "Creating..." : "Create and open"}
          </button>
        </form>
      )}

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {data &&
        (data.workspaces.length === 0 ? (
          <EmptyState
            title="No workspaces yet"
            body="Start the first study group or project team for this course. Task board and group chat included."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.workspaces.map((w) => (
              <div key={w.id} className="card-interactive flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <WorkspaceTypeBadge type={w.type} />
                  <span className="text-xs font-bold text-slate-400">
                    {w.memberCount} member{w.memberCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-3 font-display text-lg font-semibold text-ink">{w.name}</p>
                <p className="mt-1 flex-1 text-xs font-medium text-slate-400">
                  {w.openTaskCount} open task{w.openTaskCount === 1 ? "" : "s"} - {w.messageCount}{" "}
                  message{w.messageCount === 1 ? "" : "s"} - created{" "}
                  {new Date(w.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-5">
                  {w.joined ? (
                    <Link href={`/workspaces/${w.id}`} className="btn-secondary w-full">
                      Open workspace
                    </Link>
                  ) : (
                    <button className="btn-primary w-full" onClick={() => handleJoin(w.id)}>
                      Join workspace
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
