"use client";

// A discussion thread. Students can post, reply, and invoke the tutor.
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/trpc";
import { Markdown } from "@/components/Markdown";
import { ContextTypeBadge, TierBadge } from "@/components/ui";

type Thread = Awaited<ReturnType<typeof api.discussion.get.query>>;
type Post = Thread["posts"][number];

export default function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [posting, setPosting] = useState(false);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      setThread(await api.discussion.get.query({ threadId }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    const body = reply.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      await api.discussion.reply.mutate({
        threadId,
        body,
        parentPostId: replyTo?.id ?? null,
      });
      setReply("");
      setReplyTo(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  async function handleAskTutor() {
    if (asking) return;
    setAsking(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.discussion.askTutor.mutate({ threadId });
      if (!result.aiConfigured) {
        setNotice(result.message);
      } else {
        await load();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAsking(false);
    }
  }

  if (!thread && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading thread...</p>;
  }
  if (error && !thread) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  const t = thread!;
  const topLevel = t.posts.filter((p) => !p.parentPostId);
  const childrenOf = (postId: string) => t.posts.filter((p) => p.parentPostId === postId);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="surface-panel mb-6 p-5">
        <Link
          href={`/courses/${t.course.id}/discussions`}
          className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 hover:text-brand-700"
        >
          {t.course.code} discussions
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
          <ContextTypeBadge type={t.contextType} />
        </div>
        <p className="mt-1 text-xs font-medium text-slate-400">started by {t.creatorName}</p>
      </header>

      {notice && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">{notice}</p>
      )}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <div className="space-y-4">
        {topLevel.map((post) => (
          <div key={post.id}>
            <PostCard post={post} onReply={() => setReplyTo(post)} />
            {childrenOf(post.id).length > 0 && (
              <div className="ml-8 mt-2 space-y-2 border-l-2 border-slate-100 pl-4">
                {childrenOf(post.id).map((child) => (
                  <PostCard key={child.id} post={child} onReply={() => setReplyTo(post)} />
                ))}
              </div>
            )}
          </div>
        ))}
        {asking && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm font-semibold text-slate-500">
            The tutor is reading the thread...
          </div>
        )}
      </div>

      <div className="surface-panel mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium leading-relaxed text-slate-600">
          <span className="font-semibold text-brand-700">Stuck as a group?</span> Invoke the AI tutor. It reads the thread and replies with hints
          {t.contextType === "EXAM" || t.contextType === "QUIZ"
            ? ", never answers to graded questions."
            : " and grounded explanations."}
        </p>
        <button className="btn-primary shrink-0" onClick={handleAskTutor} disabled={asking}>
          {asking ? "Thinking..." : "Invoke tutor"}
        </button>
      </div>

      <form onSubmit={handleReply} className="surface-panel mt-6 p-4">
        {replyTo && (
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            Replying to <span className="font-semibold">{replyTo.authorName}</span>
            <button
              type="button"
              className="font-semibold text-brand-600 hover:text-brand-700"
              onClick={() => setReplyTo(null)}
            >
              cancel
            </button>
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            className="input min-h-[3rem] flex-1 resize-y"
            rows={2}
            placeholder={replyTo ? `Reply to ${replyTo.authorName}...` : "Add to the discussion..."}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={posting || !reply.trim()}>
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PostCard({ post, onReply }: { post: Post; onReply: () => void }) {
  return (
    <div
      className={`rounded-lg px-4 py-3 ${
        post.isAi
          ? "border border-brand-200 bg-brand-50/70"
          : "border border-white/70 bg-white/[0.86] shadow-card backdrop-blur"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-600">
          {post.isAi ? "Tutor" : post.authorName}
          <span className="ml-2 font-medium text-slate-400">
            {new Date(post.createdAt).toLocaleString()}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {post.isAi && typeof post.tier === "number" && <TierBadge tier={post.tier} />}
          {!post.isAi && (
            <button className="text-xs font-semibold text-brand-600 hover:text-brand-700" onClick={onReply}>
              Reply
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 text-[15px]">
        {post.isAi ? (
          <Markdown>{post.body}</Markdown>
        ) : (
          <p className="whitespace-pre-wrap">{post.body}</p>
        )}
      </div>
    </div>
  );
}
