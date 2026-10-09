"use client";

// The tutor chat. Assistant replies show the hint tier when relevant.
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/trpc";
import { Markdown } from "@/components/Markdown";
import { ModeBadge, TierBadge } from "@/components/ui";
import type { TutorMessage } from "@coursemind/core";

type SessionPayload = Awaited<ReturnType<typeof api.tutor.getSession.query>>;

const MODE_PLACEHOLDERS: Record<string, string> = {
  CONCEPT: "Ask anything, like: Why does quicksort degrade to O(n^2)?",
  ASSIGNMENT_HELP: "Describe the assignment problem you're stuck on.",
  CODE_REVIEW: "Paste your code with a note about what it should do.",
  DEBUG: "Paste the broken code plus the error or wrong behavior.",
};

export default function TutorSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.tutor.getSession.query({ sessionId });
        setSession(data);
        setMessages(data.messages);
        if (!data.aiConfigured) {
          setNotice(
            "No Anthropic API key is configured yet, so the tutor cannot reply. See README.md under Enabling AI features."
          );
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", content, createdAt: now }]);
    setInput("");
    try {
      const reply = await api.tutor.sendMessage.mutate({ sessionId, content });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply.content,
          tier: reply.tier ?? undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (!reply.aiConfigured) {
        setNotice("The tutor needs an ANTHROPIC_API_KEY to reply. See README.md.");
      }
    } catch (err) {
      setError(errorMessage(err));
      setInput(content);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  if (!session && !error) {
    return <p className="py-12 text-center text-sm text-slate-400">Loading session...</p>;
  }
  if (error && !session) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <header className="surface-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <Link href="/tutor" className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 hover:text-brand-700">
            All sessions
          </Link>
          <h1 className="truncate font-display text-xl font-semibold text-ink">{session!.title}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ModeBadge mode={session!.mode} />
          {session!.course && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              {session!.course.code}
            </span>
          )}
        </div>
      </header>

      {notice && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
          {notice}
        </p>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border border-white/70 bg-white/[0.48] p-4 shadow-card backdrop-blur">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="mx-auto mt-10 max-w-lg text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-ink text-xs font-semibold text-white shadow-card">
                AI
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-ink">
                {session!.mode === "ASSIGNMENT_HELP"
                  ? "Start with what you tried."
                  : "What do you want to understand?"}
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                {session!.mode === "ASSIGNMENT_HELP"
                  ? "The tutor will guide you through hints and checks so the final answer is still yours."
                  : MODE_PLACEHOLDERS[session!.mode]}
              </p>
            </div>
          )}
          {messages.map((message, i) =>
            message.role === "user" ? (
              <div
                key={i}
                className="ml-auto max-w-[88%] rounded-lg bg-brand-600 px-4 py-3 text-[15px] font-medium text-white shadow-card sm:max-w-[78%]"
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div
                key={i}
                className="max-w-[92%] rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-card sm:max-w-[82%]"
              >
                {typeof message.tier === "number" && (
                  <div className="mb-2">
                    <TierBadge tier={message.tier} />
                  </div>
                )}
                <Markdown>{message.content}</Markdown>
              </div>
            )
          )}
          {busy && (
            <div className="max-w-[82%] rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-sm font-semibold text-slate-400 shadow-card">
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && session && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      )}

      <div className="surface-panel p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            className="input min-h-[3.2rem] flex-1 resize-y"
            rows={2}
            placeholder={MODE_PLACEHOLDERS[session!.mode]}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button onClick={send} disabled={busy || !input.trim()} className="btn-primary sm:min-w-28">
            Send
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
          Enter to send. Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
}
