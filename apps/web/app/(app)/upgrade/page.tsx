"use client";

// Pricing / plan management. The "Upgrade to Pro" button is a placeholder that
// flips the plan flag (real billing - e.g. Stripe - hooks in here later).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";

const FREE_FEATURES = [
  "Join your courses and shared material library",
  "Course group chat + study-group chats",
  "Discussion boards and shared notes",
  "Access every past test and material, every semester",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "AI in the group chat - grounded in your class materials",
  "AI tutor with hint tiers on assignments",
  "Quiz & flashcard generation, mock exams, study plans",
];

export default function UpgradePage() {
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.user.me
      .query()
      .then((me) => setPlan(me.plan))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.user.upgradeToPro.mutate();
      setPlan(res.plan);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function downgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.user.downgradeToFree.mutate();
      setPlan(res.plan);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isPro = plan === "PRO";

  return (
    <div>
      <PageHeader
        title="Plans"
        subtitle="Sharing materials and chatting with your class is always free. Pro unlocks the AI."
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Free */}
        <div className="card flex flex-col">
          <p className="eyebrow">Free</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">
            $0<span className="text-base font-medium text-slate-400"> / forever</span>
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {isPro ? (
              <button onClick={downgrade} disabled={busy} className="btn-secondary w-full">
                {busy ? "..." : "Switch to Free"}
              </button>
            ) : (
              <span className="block rounded-lg bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-600">
                Your current plan
              </span>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="card flex flex-col ring-2 ring-brand-300">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Pro</p>
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">Most popular</span>
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">
            $6<span className="text-base font-medium text-slate-400"> / month</span>
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className={`flex items-start gap-2 text-sm font-medium ${i === 0 ? "text-slate-500" : "text-slate-700"}`}>
                {i > 0 && <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">✓</span>}
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {isPro ? (
              <span className="block rounded-lg bg-brand-50 px-4 py-2.5 text-center text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
                You&apos;re on Pro ✦
              </span>
            ) : (
              <button onClick={upgrade} disabled={busy} className="btn-primary w-full">
                {busy ? "Upgrading..." : "Upgrade to Pro"}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs font-medium text-slate-400">
        Billing isn&apos;t wired up yet - upgrading is instant and free while we&apos;re in early access.
      </p>
    </div>
  );
}
