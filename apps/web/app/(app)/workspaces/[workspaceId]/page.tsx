"use client";

// A workspace: members, shared task board, and group chat.
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader, WorkspaceTypeBadge } from "@/components/ui";
import {
  CHAT_POLL_INTERVAL_MS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@coursemind/core";

type Workspace = Awaited<ReturnType<typeof api.workspace.get.query>>;
type ChatMessage = Awaited<ReturnType<typeof api.workspace.chatList.query>>[number];

const NEEDS_JOIN = "You need to join this workspace first.";

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setWorkspace(await api.workspace.get.query({ workspaceId }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleJoin() {
    setBusy(true);
    try {
      await api.workspace.join.mutate({ workspaceId });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!workspace && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading workspace...</p>;
  }
  if (error && !workspace) {
    return (
      <div className="card mx-auto mt-12 max-w-md text-center">
        <div className="icon-mark mx-auto bg-brand-600">
          <Users size={16} strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="mt-4 font-display text-lg font-semibold text-ink">
          {error === NEEDS_JOIN ? "You are not in this workspace yet" : "Could not open this workspace"}
        </p>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{error}</p>
        {error === NEEDS_JOIN && (
          <button className="btn-primary mt-5" onClick={handleJoin} disabled={busy}>
            {busy ? "Joining..." : "Join this workspace"}
          </button>
        )}
      </div>
    );
  }

  const w = workspace!;
  return (
    <div>
      <PageHeader
        title={w.name}
        subtitle={`${w.course.code} workspace${w.project.description ? ` - ${w.project.description}` : ""}`}
        action={<WorkspaceTypeBadge type={w.type} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {w.members.map((m) => (
          <span
            key={m.userId}
            className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
            title={m.role === "OWNER" ? "Workspace owner" : "Member"}
          >
            {m.name}
            {m.role === "OWNER" ? " (owner)" : ""}
          </span>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <TaskBoard workspace={w} onChanged={load} onError={setError} />
        <ChatPanel workspaceId={w.id} />
      </div>
    </div>
  );
}

function TaskBoard({
  workspace,
  onChanged,
  onError,
}: {
  workspace: Workspace;
  onChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const memberName = (userId: string | null) =>
    workspace.members.find((m) => m.userId === userId)?.name ?? null;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      onError(null);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    await run(() => api.workspace.addTask.mutate({ workspaceId: workspace.id, title }));
  }

  return (
    <section className="lg:col-span-2">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Planning</p>
          <h2 className="font-display text-xl font-semibold text-ink">Task board</h2>
        </div>
        <form onSubmit={addTask} className="flex flex-1 gap-2 sm:max-w-md">
          <input
            className="input py-2 text-sm"
            placeholder="Add a task..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn-secondary py-2" disabled={busy || !newTitle.trim()}>
            Add
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TASK_STATUSES.map((status) => {
          const tasks = workspace.project.tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="surface-panel p-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {TASK_STATUS_LABELS[status]} - {tasks.length}
              </p>
              <div className="space-y-2">
                {tasks.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs font-medium text-slate-400">Nothing here</p>
                )}
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-lg bg-white p-3 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-ink">{task.title}</p>
                      <button
                        className="text-xs font-semibold text-slate-300 transition hover:text-rose-500"
                        title="Delete task"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            api.workspace.deleteTask.mutate({
                              workspaceId: workspace.id,
                              taskId: task.id,
                            })
                          )
                        }
                      >
                        x
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <select
                        className="max-w-[60%] rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600"
                        value={task.assigneeId ?? ""}
                        disabled={busy}
                        title="Assignee"
                        onChange={(e) =>
                          run(() =>
                            api.workspace.updateTask.mutate({
                              workspaceId: workspace.id,
                              taskId: task.id,
                              assigneeId: e.target.value || null,
                            })
                          )
                        }
                      >
                        <option value="">Unassigned</option>
                        {workspace.members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.userId === workspace.myUserId ? `${m.name} (me)` : m.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex shrink-0 gap-1">
                        <MoveButton task={task} dir={-1} workspace={workspace} busy={busy} run={run} />
                        <MoveButton task={task} dir={1} workspace={workspace} busy={busy} run={run} />
                      </div>
                    </div>
                    {task.assigneeId && !memberName(task.assigneeId) && (
                      <p className="mt-1 text-[10px] font-medium text-amber-600">assignee left the workspace</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MoveButton({
  task,
  dir,
  workspace,
  busy,
  run,
}: {
  task: Workspace["project"]["tasks"][number];
  dir: -1 | 1;
  workspace: Workspace;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const index = TASK_STATUSES.indexOf(task.status);
  const target = TASK_STATUSES[index + dir] as TaskStatus | undefined;
  if (!target) return <span className="w-6" />;
  return (
    <button
      className="rounded-lg bg-slate-100 px-1.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-brand-100 hover:text-brand-700"
      title={`Move to ${TASK_STATUS_LABELS[target]}`}
      disabled={busy}
      onClick={() =>
        run(() =>
          api.workspace.updateTask.mutate({
            workspaceId: workspace.id,
            taskId: task.id,
            status: target,
          })
        )
      }
    >
      {dir === -1 ? "<" : ">"}
    </button>
  );
}

function ChatPanel({ workspaceId }: { workspaceId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setMessages(await api.workspace.chatList.query({ workspaceId }));
    } catch {
      // Polling stays quiet on transient errors; the next tick retries.
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.workspace.chatSend.mutate({ workspaceId, body });
      setInput("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex h-[32rem] flex-col lg:col-span-1">
      <div className="mb-3">
        <p className="eyebrow">Live room</p>
        <h2 className="font-display text-xl font-semibold text-ink">Group chat</h2>
      </div>
      <div className="surface-panel flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs font-medium text-slate-400">
              No messages yet. Say hi to your group.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.mine ? "text-right" : "text-left"}>
              <p className="text-[10px] font-medium text-slate-400">
                {m.mine ? "" : `${m.authorName} - `}
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p
                className={`mt-0.5 inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  m.mine
                    ? "bg-brand-600 text-white"
                    : "bg-white text-ink shadow-sm"
                }`}
              >
                {m.body}
              </p>
            </div>
          ))}
        </div>
        {error && <p className="bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</p>}
        <div className="flex items-end gap-2 border-t border-slate-200 p-3">
          <textarea
            className="input min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
            rows={1}
            placeholder="Message the group..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn-primary py-2" onClick={send} disabled={sending || !input.trim()}>
            Send
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] font-medium text-slate-400">
        Updates every {Math.round(CHAT_POLL_INTERVAL_MS / 1000)}s. Enter to send.
      </p>
    </section>
  );
}
