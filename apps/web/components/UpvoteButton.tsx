"use client";

// The class's quality signal on a shared material. Optimistic toggle;
// the server keeps upvoteCount authoritative and rewards the uploader's
// XP (see material.upvote). Disabled on your own uploads.
import { useState } from "react";
import { api, errorMessage } from "@/lib/trpc";

export function UpvoteButton({
  materialId,
  initialCount,
  initialUpvoted,
  isMine,
}: {
  materialId: string;
  initialCount: number;
  initialUpvoted: boolean;
  isMine: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy || isMine) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.material.upvote.mutate({ materialId });
      setUpvoted(result.upvoted);
      setCount(result.upvoteCount);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={busy || isMine}
        title={
          isMine
            ? "This is your upload - classmates upvote it to surface it for everyone"
            : upvoted
              ? "Remove your upvote"
              : "Upvote - help the best materials rise to the top"
        }
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed ${
          upvoted
            ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
            : "border-slate-200 bg-white/90 text-ink hover:border-brand-300 hover:bg-white disabled:opacity-60"
        }`}
      >
        <span aria-hidden className="text-[15px] leading-none">
          {upvoted ? "▲" : "△"}
        </span>
        <span>{count}</span>
        <span className="font-medium">{count === 1 ? "upvote" : "upvotes"}</span>
      </button>
      {error && <p className="max-w-xs text-right text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
