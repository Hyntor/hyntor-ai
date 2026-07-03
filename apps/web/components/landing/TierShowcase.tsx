"use client";

// Interactive hint-tier explorer: click a tier, see exactly how the tutor's
// help deepens - same question, four different depths of help.
import { useState } from "react";

const QUESTION = "“How do I prove this recurrence on problem set 4?”";

const TIERS = [
  {
    n: 1,
    name: "Nudge",
    tagline: "Points you at the right concept",
    reply:
      "This is a divide-and-conquer recurrence - the Master Theorem section of your Week 6 notes covers exactly this shape. Which case do you think T(n) = 2T(n/2) + n falls into?",
  },
  {
    n: 2,
    name: "Guiding question",
    tagline: "Asks the question that unlocks the next step",
    reply:
      "Good start. Compare n^(log_2 2) with the f(n) = n term - are they the same order of growth? What does the theorem say happens when they match?",
  },
  {
    n: 3,
    name: "Analogous example",
    tagline: "Works a similar problem, never yours",
    reply:
      "Let me work a different one fully: T(n) = 3T(n/3) + n. Here n^(log_3 3) = n matches f(n) = n, so Case 2 gives Θ(n log n). I'll walk through why... now apply the same comparison to your recurrence.",
  },
  {
    n: 4,
    name: "Structured walkthrough",
    tagline: "Outlines every step - you write the proof",
    reply:
      "Here's the full path: Step 1 - identify a, b, and f(n). Step 2 - compute n^(log_b a). Step 3 - compare growth rates and pick the case. Step 4 - state the bound and verify with the tree method. You write each step for your recurrence.",
  },
];

export function TierShowcase() {
  const [active, setActive] = useState(0);
  const tier = TIERS[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col gap-2.5">
        {TIERS.map((t, i) => (
          <button
            key={t.n}
            onClick={() => setActive(i)}
            className={`group flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-300 ${
              i === active
                ? "border-brand-500/50 bg-brand-500/10 shadow-[0_0_35px_-8px_rgba(10,132,255,0.5)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-lg font-bold transition ${
                i === active ? "bg-brand-500 text-white" : "bg-white/10 text-slate-300"
              }`}
            >
              {t.n}
            </span>
            <span>
              <span className={`block font-display font-semibold ${i === active ? "text-white" : "text-slate-200"}`}>
                {t.name}
              </span>
              <span className="block text-xs font-medium text-slate-400">{t.tagline}</span>
            </span>
          </button>
        ))}
        {/* Engagement meter */}
        <div className="mt-2 px-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>Less help</span>
            <span>You engage → help deepens</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-[#b388ff] transition-all duration-500"
              style={{ width: `${((active + 1) / TIERS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">The student asks</p>
        <p className="mt-2 font-display text-lg font-semibold text-white">{QUESTION}</p>
        <div className="mt-5 flex-1 rounded-xl border border-white/10 bg-[#060a14]/60 p-5" key={active}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-bold text-brand-300 ring-1 ring-brand-500/30">
            Tier {tier.n} · {tier.name}
          </span>
          <p className="reveal is-visible mt-3 text-[15px] font-medium leading-relaxed text-slate-300">
            {tier.reply}
          </p>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-500">
          The ceiling rises one tier per exchange - deep help is earned, never handed out. The final answer is always yours.
        </p>
      </div>
    </div>
  );
}
