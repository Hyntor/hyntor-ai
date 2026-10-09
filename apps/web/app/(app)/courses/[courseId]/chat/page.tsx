"use client";

// Course-wide GROUP CHAT (free): everyone enrolled shares one live chat, polled
// every few seconds. "Ask AI" reads the chat + the course's shared materials
// and replies in the thread - a Pro feature, so free users get an upgrade nudge.
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/trpc";
import { Markdown } from "@/components/Markdown";
import { TierBadge } from "@/components/ui";
import { CHAT_POLL_INTERVAL_MS } from "@coursemind/core";

type Course = Awaited<ReturnType<typeof api.course.get.query>>;
type Message = Awaited<ReturnType<typeof api.courseChat.list.query>>[number];

export default function CourseChatPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needUpgrade, setNeedUpgrade] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const [c, me] = await Promise.all([api.course.get.query({ courseId }), api.user.me.query()]);
        setCourse(c);
        setIsPro(me.plan === "PRO");
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [courseId]);

  const refresh = useCallback(async () => {
    try {
      setMessages(await api.courseChat.list.query({ courseId }));
    } catch {
      /* polling: stay quiet on transient errors */
    }
  }, [courseId]);

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
      await api.courseChat.send.mutate({ courseId, body });
      setInput("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function askAi() {
    if (asking) return;
    if (!isPro) {
      setNeedUpgrade(true);
      return;
    }
    setAsking(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.courseChat.askAi.mutate({ courseId });
      if (result.upgradeRequired) {
        setNeedUpgrade(true);
      } else if (!result.ok) {
        setNotice(result.message);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAsking(false);
    }
  }

  if (!course && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading chat...</p>;
  }
  if (error && !course) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col">
      <div className="mb-4">
        <Link href={`/courses/${courseId}`} className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 hover:text-brand-700">
          {course!.code} course
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold text-ink">Group chat</h1>
          <button
            onClick={askAi}
            disabled={asking}
            className={isPro ? "btn-primary" : "btn-secondary"}
            title={isPro ? "Ask the AI, grounded in this course's materials" : "Pro feature"}
          >
            {asking ? "AI is reading..." : isPro ? "Ask AI" : "Ask AI ✦ Pro"}
          </button>
        </div>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Everyone in {course!.code} shares this chat. Share materials, ask questions, prep together.
        </p>
      </div>

      {needUpgrade && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">
            <span className="font-semibold text-brand-700">Ask AI is a Pro feature.</span> Unlock an
            AI that reads your class materials and the group&apos;s questions.
          </p>
          <Link href="/upgrade" className="btn-primary shrink-0">Upgrade to Pro</Link>
        </div>
      )}
      {notice && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">{notice}</p>}

      <div className="surface-panel flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm font-medium text-slate-400">
              No messages yet - say hi and share something useful for the class.
            </p>
          )}
          {messages.map((m) =>
            m.isAi ? (
              <div key={m.id} className="rounded-lg border border-brand-200 bg-brand-50/70 px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-700">{m.authorName}</span>
                  {typeof m.tier === "number" && <TierBadge tier={m.tier} />}
                </div>
                <div className="text-[15px]">
                  <Markdown>{m.body}</Markdown>
                </div>
              </div>
            ) : (
              <div key={m.id} className={m.mine ? "text-right" : "text-left"}>
                <p className="text-[10px] font-medium text-slate-400">
                  {m.mine ? "" : `${m.authorName} · `}
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p
                  className={`mt-0.5 inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${
                    m.mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-slate-100 text-ink"
                  }`}
                >
                  {m.body}
                </p>
              </div>
            )
          )}
        </div>
        {error && course && <p className="bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</p>}
        <div className="flex items-end gap-2 border-t border-slate-200 p-3">
          <textarea
            className="input min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
            rows={1}
            placeholder={`Message ${course!.code}...`}
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
        Updates every {Math.round(CHAT_POLL_INTERVAL_MS / 1000)}s · Enter to send
      </p>
    </div>
  );
}
