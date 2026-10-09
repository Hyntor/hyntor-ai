"use client";

// The hero's centerpiece: a scripted, auto-playing tutor conversation that
// demos the hint-tier system - typewriter text, typing dots, tier badges.
// Loops forever. Pure setTimeout state machine, no animation library.
import { useEffect, useRef, useState } from "react";

interface DemoMessage {
  role: "student" | "ai";
  text: string;
  tier?: number;
  tierName?: string;
}

const SCRIPT: DemoMessage[] = [
  { role: "student", text: "How do I solve 3(b) on the hashing homework?" },
  {
    role: "ai",
    tier: 1,
    tierName: "Nudge",
    text: "That one leans on load factor - your Lecture 9 notes, page 3. What's the table's α right before it resizes?",
  },
  { role: "student", text: "α = 0.75... but I still don't get the probe count." },
  {
    role: "ai",
    tier: 2,
    tierName: "Guiding question",
    text: "You're close. At α = 0.75, roughly how many slots does an unsuccessful lookup touch? Try 1 / (1 − α).",
  },
  { role: "student", text: "Ohh - 4 probes. It finally clicked." },
  {
    role: "ai",
    tier: 0,
    tierName: "You got it",
    text: "Exactly. Now apply it to 3(b) - the answer is yours, not mine.",
  },
];

const TYPE_MS = 26; // per character
const STUDENT_TYPE_MS = 14;
const THINK_MS = 900; // typing-dots pause before an AI message
const BETWEEN_MS = 650; // pause after a message completes
const RESTART_MS = 5200; // hold the finished conversation, then loop

type Phase = "thinking" | "typing" | "waiting" | "done";

export function HeroDemo() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<Phase>("thinking");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const current = SCRIPT[msgIndex];
    let t: ReturnType<typeof setTimeout>;

    if (phase === "thinking") {
      t = setTimeout(
        () => setPhase("typing"),
        current.role === "ai" ? THINK_MS : 350
      );
    } else if (phase === "typing") {
      if (chars < current.text.length) {
        t = setTimeout(
          () => setChars((c) => c + 1),
          current.role === "ai" ? TYPE_MS : STUDENT_TYPE_MS
        );
      } else {
        t = setTimeout(() => setPhase("waiting"), BETWEEN_MS);
      }
    } else if (phase === "waiting") {
      if (msgIndex < SCRIPT.length - 1) {
        setMsgIndex((i) => i + 1);
        setChars(0);
        setPhase("thinking");
      } else {
        setPhase("done");
      }
    } else {
      // done: hold, then restart the loop.
      t = setTimeout(() => {
        setMsgIndex(0);
        setChars(0);
        setPhase("thinking");
      }, RESTART_MS);
    }
    return () => clearTimeout(t);
  }, [phase, chars, msgIndex]);

  // Keep the newest message in view inside the card.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chars, msgIndex, phase]);

  const visible = SCRIPT.slice(0, msgIndex + (phase === "thinking" ? 0 : 1));
  const isTyping = phase === "typing";

  return (
    <div className="relative">
      {/* Floating stat chips around the card. */}
      <div className="landing-float absolute -left-4 -top-5 z-10 hidden rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2 backdrop-blur-xl sm:block" style={{ animationDelay: "0.6s" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Streak</p>
        <p className="font-display text-lg font-semibold text-white">6 days 🔥</p>
      </div>
      <div className="landing-float absolute -right-3 top-16 z-10 hidden rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2 backdrop-blur-xl lg:block" style={{ animationDelay: "1.4s" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Best quiz</p>
        <p className="font-display text-lg font-semibold text-white">92%</p>
      </div>
      <div className="landing-float absolute -bottom-5 right-8 z-10 hidden rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2 backdrop-blur-xl sm:block" style={{ animationDelay: "2.2s" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due cards</p>
        <p className="font-display text-lg font-semibold text-white">12</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_30px_90px_-20px_rgba(10,132,255,0.35)] backdrop-blur-xl">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 text-xs font-semibold text-slate-400">CS 201 · AI Tutor</span>
          <span className="ml-auto rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-300 ring-1 ring-brand-500/30">
            Hint mode
          </span>
        </div>

        <div ref={scrollRef} className="flex h-[21rem] flex-col gap-3 overflow-hidden p-4 sm:h-[22rem]">
          {visible.map((m, i) => {
            const isLast = i === visible.length - 1;
            const text = isLast && isTyping ? m.text.slice(0, chars) : m.text;
            if (m.role === "student") {
              return (
                <div key={i} className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-600/20">
                  {text}
                  {isLast && isTyping && <span className="landing-caret" />}
                </div>
              );
            }
            return (
              <div key={i} className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-medium leading-relaxed text-slate-200">
                {typeof m.tier === "number" && (
                  <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                    m.tier === 0
                      ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                      : "bg-brand-500/15 text-brand-300 ring-brand-500/30"
                  }`}>
                    {m.tier === 0 ? "✓" : `Tier ${m.tier}`} · {m.tierName}
                  </span>
                )}
                <p>
                  {text}
                  {isLast && isTyping && <span className="landing-caret" />}
                </p>
              </div>
            );
          })}

          {phase === "thinking" && SCRIPT[msgIndex].role === "ai" && (
            <div className="flex w-16 items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-3.5">
              <span className="landing-dot" />
              <span className="landing-dot" style={{ animationDelay: "0.18s" }} />
              <span className="landing-dot" style={{ animationDelay: "0.36s" }} />
            </div>
          )}
        </div>

        <div className="border-t border-white/5 px-4 py-3">
          <p className="text-center text-[11px] font-semibold text-slate-500">
            Real product behavior - the tutor escalates hints as you engage, never dumps the answer.
          </p>
        </div>
      </div>
    </div>
  );
}
