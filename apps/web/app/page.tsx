// Landing page: public product pitch. Dark, animated marketing surface -
// the app itself stays light. The hero leads with the AI study partner
// ("Don't just get the answer. Actually learn it."); the middle of the page
// markets the SHARED CLASS LIBRARY hard (real materials, real past exams,
// inherited semester after semester) - that library is also exactly what
// makes the Pro AI smart. Animated pieces are client components in
// components/landing/.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowBigUp,
  ClipboardList,
  FileText,
  Presentation,
  Sparkles,
} from "lucide-react";
import { auth } from "@/auth";
import { Logo } from "@/components/ui";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { TierShowcase } from "@/components/landing/TierShowcase";
import { Reveal } from "@/components/landing/Reveal";

const MARQUEE = [
  "CS 201 · Data Structures",
  "BIO 110 · Cell Biology",
  "ECON 301 · Econometrics",
  "MATH 244 · Linear Algebra",
  "PSYC 101 · Intro Psych",
  "CHEM 202 · Organic Chemistry",
  "PHYS 214 · Quantum I",
  "STAT 400 · Probability",
  "CS 348 · Databases",
  "ML 301 · Machine Learning",
  "HIST 172 · Modern Europe",
  "EE 250 · Signals & Systems",
];

const STEPS = [
  {
    n: "01",
    title: "Bring your class in",
    body: "Join your course and pool what actually matters: lecture notes, slides, homework prompts, past exams. One classmate's upload makes the AI smarter for everyone enrolled.",
  },
  {
    n: "02",
    title: "Study from YOUR course",
    body: "The tutor, quizzes, flashcards, and mock exams are all grounded in your professor's own materials - not generic internet answers. It speaks your class's language.",
  },
  {
    n: "03",
    title: "Earn deeper help",
    body: "On graded work the AI starts with a nudge and escalates only as you engage - hint, guiding question, analogous example, walkthrough. The final answer stays yours.",
  },
];

const SEMESTERS = [
  { label: "Fall 2024", count: 12, height: "22%" },
  { label: "Spring 2025", count: 43, height: "52%" },
  { label: "Fall 2025", count: 84, height: "100%" },
  { label: "You · Spring 2026", count: 84, height: "100%", you: true },
];

const STATS = [
  { value: "1", label: "shared library per class - upload once, everyone benefits" },
  { value: "0", label: "answer dumps on graded work - by design, not by policy" },
  { value: "4", label: "hint tiers that unlock as you engage with the problem" },
  { value: "$0", label: "to start - the whole class can join free today" },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="overflow-hidden bg-[#060a14] text-white">
      <LandingNav />

      {/* ================= Hero ================= */}
      <section className="relative">
        {/* Animated glow field */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="landing-orb left-[8%] top-[-6rem] h-[26rem] w-[26rem]"
            style={{ background: "rgba(10,132,255,0.32)" }}
          />
          <div
            className="landing-orb right-[4%] top-[6rem] h-[22rem] w-[22rem]"
            style={{ background: "rgba(94,92,230,0.26)", animationDelay: "-6s" }}
          />
          <div
            className="landing-orb bottom-[-8rem] left-[38%] h-[24rem] w-[24rem]"
            style={{ background: "rgba(10,132,255,0.18)", animationDelay: "-11s" }}
          />
          {/* Fine grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-32 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-28 lg:pt-40">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                AI that knows your class
              </span>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                Don&apos;t just get the answer.
                <br />
                <span className="landing-shimmer">Actually learn it.</span>
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-400">
                Hyntor turns your class&apos;s real materials - the slides, notes, homework, and past
                exams your professor actually uses - into an AI study partner that guides you{" "}
                <span className="text-slate-200">to</span> the answer on graded work, never{" "}
                <span className="text-slate-200">past</span> it.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="landing-cta-glow rounded-xl bg-brand-500 px-6 py-3.5 text-base font-bold text-white transition hover:bg-brand-600"
                >
                  Start free with your class →
                </Link>
                <a
                  href="#how"
                  className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-slate-200 backdrop-blur transition hover:border-white/30 hover:bg-white/10"
                >
                  See how it works
                </a>
              </div>
            </Reveal>
            <Reveal delay={340}>
              <p className="mt-6 text-sm font-medium text-slate-500">
                Free to start · Sign in with Google · Live group chat included
              </p>
            </Reveal>
          </div>

          <Reveal delay={220}>
            <HeroDemo />
          </Reveal>
        </div>

        {/* Marquee */}
        <div className="relative border-y border-white/5 bg-white/[0.02] py-5">
          <p className="pb-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Built for every class you&apos;re taking
          </p>
          <div
            className="overflow-hidden"
            style={{
              maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
              WebkitMaskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <div className="landing-marquee gap-4 pr-4">
              {[...MARQUEE, ...MARQUEE].map((c, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-semibold text-slate-400"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section id="how" className="relative scroll-mt-20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">How it works</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Your whole class, one brain.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="landing-tile h-full p-7">
                  <span className="font-display text-4xl font-bold text-brand-500/60">{s.n}</span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-3 text-[15px] font-medium leading-relaxed text-slate-400">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= The course library (semester legacy) ================= */}
      <section id="legacy" className="relative scroll-mt-20 border-t border-white/5">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="landing-orb left-[12%] top-[8rem] h-[20rem] w-[20rem]"
            style={{ background: "rgba(10,132,255,0.14)", animationDelay: "-8s" }}
          />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">The course library</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Materials outlive
                <br />
                the semester.
              </h2>
              <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-slate-400">
                Your course gets created once - every semester, new students join the{" "}
                <span className="text-slate-200">same page</span> and inherit the whole library on day
                one: last year&apos;s midterm, the annotated slides, the study guide that saved finals
                week. Elsewhere that knowledge dies in a group chat. Here it{" "}
                <span className="text-slate-200">compounds</span>.
              </p>
              <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-slate-400">
                And the bigger the library grows, the smarter the AI gets - it reads everything your
                class has ever shared.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <div className="landing-tile p-8">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  PSYC 101 · library size by semester
                </p>
                <div className="mt-6 flex h-56 gap-4">
                  {SEMESTERS.map((s) => (
                    <div key={s.label} className="flex flex-1 flex-col items-center gap-3">
                      <span className={`font-display text-lg font-bold ${s.you ? "text-brand-300" : "text-white"}`}>
                        {s.count}
                        {s.you && <span className="text-brand-400">+</span>}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-700 ${
                            s.you
                              ? "bg-gradient-to-t from-brand-600 to-brand-400 shadow-[0_0_30px_-4px_rgba(10,132,255,0.6)]"
                              : "bg-white/15"
                          }`}
                          style={{ height: s.height }}
                        />
                      </div>
                      <span
                        className={`text-center text-[11px] font-bold ${
                          s.you ? "text-brand-300" : "text-slate-500"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-center text-xs font-semibold text-slate-500">
                  You start with everything. You leave it bigger.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= Features bento ================= */}
      <section id="features" className="relative scroll-mt-20 border-t border-white/5">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="landing-orb right-[10%] top-[10rem] h-[20rem] w-[20rem]"
            style={{ background: "rgba(10,132,255,0.14)", animationDelay: "-4s" }}
          />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Everything in one place</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              A full study OS for your course.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* Shared library - large tile */}
            <Reveal className="lg:col-span-2">
              <div className="landing-tile h-full p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-sm">
                    <h3 className="font-display text-xl font-semibold text-white">One shared class library</h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                      Slides, notes, homework, study guides - uploaded once, useful to everyone
                      enrolled, this semester and every one after. Upvotes rank what the class actually
                      found helpful, and it&apos;s all searchable and readable in the browser.
                    </p>
                  </div>
                  <div className="min-w-[15rem] flex-1 space-y-2">
                    {[
                      { icon: ClipboardList, name: "Final Exam (2024) - walkthrough", votes: 56 },
                      { icon: FileText, name: "Lecture 7 - Memory notes", votes: 28 },
                      { icon: Presentation, name: "Week 9 slides - annotated", votes: 23 },
                    ].map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-medium text-slate-300"
                      >
                        <f.icon size={14} className="shrink-0 text-brand-300" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="inline-flex items-center gap-0.5 font-bold text-slate-400">
                          <ArrowBigUp size={12} aria-hidden="true" />
                          {f.votes}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Past exams */}
            <Reveal delay={100}>
              <div className="landing-tile h-full p-7">
                <h3 className="font-display text-xl font-semibold text-white">Real past exams</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                  The most valuable thing a class can pass down. Practice on the exams your course
                  actually gave - shared by the students who took them.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5">
                  <ClipboardList size={15} className="shrink-0 text-amber-300" aria-hidden="true" />
                  <span className="text-xs font-semibold text-amber-200">
                    Midterm 2 (2025) · shared 3 days before yours
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Group chat */}
            <Reveal>
              <div className="landing-tile h-full p-7">
                <h3 className="font-display text-xl font-semibold text-white">Live class group chat</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                  One chat per course. Share, ask, vent before the midterm. On Pro, the AI joins in -
                  reading the chat and your class&apos;s library.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="w-fit rounded-xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-300">
                    anyone get #4 on the pset? 😩
                  </div>
                  <div className="ml-auto flex w-fit items-center gap-1.5 rounded-xl rounded-br-sm bg-brand-600/80 px-3 py-1.5 text-xs font-medium text-white">
                    <FileText size={12} aria-hidden="true" />
                    check the PS3 guide in the library ↑
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Grounded tutor */}
            <Reveal delay={80}>
              <div className="landing-tile h-full p-7">
                <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
                  <Sparkles size={18} className="text-brand-300" aria-hidden="true" />
                  A tutor grounded in your course
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                  Answers cite your actual materials - &quot;your Lecture 9 notes cover this&quot; - and
                  flag anything beyond what your professor has shared.
                </p>
                <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3.5 py-2.5 text-xs font-semibold text-brand-300">
                  ✓ Grounding the tutor with 14 class materials
                </div>
              </div>
            </Reveal>

            {/* Visualizer */}
            <Reveal delay={160}>
              <div className="landing-tile h-full p-7">
                <h3 className="font-display text-xl font-semibold text-white">Concept visualizer</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                  Name any concept - get a map of the ideas around it: prerequisites, examples,
                  pitfalls, and how to practice.
                </p>
                <svg viewBox="0 0 220 90" className="mt-4 w-full" aria-hidden="true">
                  <line x1="110" y1="45" x2="35" y2="20" stroke="rgba(255,255,255,0.15)" />
                  <line x1="110" y1="45" x2="185" y2="18" stroke="rgba(255,255,255,0.15)" />
                  <line x1="110" y1="45" x2="40" y2="72" stroke="rgba(255,255,255,0.15)" />
                  <line x1="110" y1="45" x2="182" y2="70" stroke="rgba(255,255,255,0.15)" />
                  <rect x="80" y="34" width="60" height="22" rx="8" fill="#0a84ff" />
                  <text x="110" y="49" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">B-Trees</text>
                  {[
                    { x: 8, y: 10, w: 54, label: "Binary trees" },
                    { x: 158, y: 8, w: 54, label: "Databases" },
                    { x: 12, y: 62, w: 56, label: "Node splits" },
                    { x: 154, y: 60, w: 56, label: "Watch: fanout" },
                  ].map((n) => (
                    <g key={n.label}>
                      <rect x={n.x} y={n.y} width={n.w} height="20" rx="7" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" />
                      <text x={n.x + n.w / 2} y={n.y + 13.5} textAnchor="middle" fontSize="8" fontWeight="600" fill="#cbd5e1">
                        {n.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </Reveal>

            {/* Leaderboard */}
            <Reveal delay={240}>
              <div className="landing-tile h-full p-7">
                <h3 className="font-display text-xl font-semibold text-white">Streaks, XP & leaderboards</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                  Sharing notes, taking quizzes, and showing up daily all earn XP. Friendly competition,
                  school-wide or per course.
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    { rank: "1", name: "Maya", w: "92%" },
                    { rank: "2", name: "You", w: "78%", me: true },
                    { rank: "3", name: "Sam", w: "61%" },
                  ].map((r) => (
                    <div key={r.rank} className="flex items-center gap-2.5">
                      <span className={`w-4 text-xs font-bold ${r.me ? "text-brand-300" : "text-slate-500"}`}>{r.rank}</span>
                      <span className={`w-10 text-xs font-semibold ${r.me ? "text-white" : "text-slate-400"}`}>{r.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${r.me ? "bg-brand-500" : "bg-white/25"}`} style={{ width: r.w }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= Hint tiers (interactive) ================= */}
      <section id="tiers" className="relative scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">The hint-tier system</p>
            <h2 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              It won&apos;t do your homework.
              <br />
              <span className="text-slate-400">That&apos;s exactly why it works.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-400">
              Try it - click a tier and watch the same question get four different depths of help.
              Concept questions always get full, generous explanations; this system only guards{" "}
              <span className="text-slate-200">graded</span> work.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-12">
              <TierShowcase />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= Stats band ================= */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.value} delay={i * 90}>
              <div>
                <p className="font-display text-5xl font-bold text-white">{s.value}</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= Pricing ================= */}
      <section id="pricing" className="relative scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Pricing</p>
            <h2 className="mt-3 text-center font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Free for the class. Pro for the AI.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal delay={80}>
              <div className="landing-tile h-full p-8">
                <h3 className="font-display text-2xl font-semibold text-white">Free</h3>
                <p className="mt-1 font-display text-4xl font-bold text-white">$0</p>
                <p className="mt-3 text-sm font-medium text-slate-400">Everything your class needs to study together.</p>
                <ul className="mt-6 space-y-3 text-sm font-medium text-slate-300">
                  {[
                    "Shared course library - notes, slides, past exams",
                    "Everything from past semesters, inherited on day one",
                    "Live class group chat & study-group workspaces",
                    "Quizzes, flashcards & leaderboards",
                  ].map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="text-brand-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block rounded-xl border border-white/15 bg-white/5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  Join free
                </Link>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="landing-tile relative h-full overflow-hidden border-brand-500/40 bg-brand-500/[0.07] p-8">
                <span className="absolute right-6 top-6 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
                <h3 className="font-display text-2xl font-semibold text-white">Pro</h3>
                <p className="mt-1 font-display text-4xl font-bold text-white">
                  $6<span className="text-lg font-semibold text-slate-400">/mo</span>
                </p>
                <p className="mt-3 text-sm font-medium text-slate-400">
                  Your whole class, one brain - an AI that has read everything your class ever shared.
                </p>
                <ul className="mt-6 space-y-3 text-sm font-medium text-slate-300">
                  {[
                    "Everything in Free",
                    "AI assistant inside the class group chat",
                    "Reads every note, lecture & past exam in the library",
                    "Hint-tier protected - helps you learn, never cheats",
                  ].map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="text-brand-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block rounded-xl bg-brand-500 py-3 text-center font-bold text-white transition hover:bg-brand-600"
                >
                  Start with Pro
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= Final CTA ================= */}
      <section className="relative border-t border-white/5">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="landing-orb left-[30%] top-[-4rem] h-[24rem] w-[30rem]"
            style={{ background: "rgba(10,132,255,0.2)" }}
          />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
              Your class is smarter
              <br />
              <span className="landing-shimmer">together.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg font-medium text-slate-400">
              Set up your course in two minutes. Invite the group chat. Watch the library grow.
            </p>
            <Link
              href="/signup"
              className="landing-cta-glow mt-10 inline-flex rounded-xl bg-brand-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-brand-600"
            >
              Get started free →
            </Link>
            <p className="mt-5 text-sm font-medium text-slate-500">No credit card · Google or email sign-in</p>
          </Reveal>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Logo dark />
              <p className="mt-2 text-sm font-medium text-slate-500">
                Don&apos;t just get the answer. Actually learn it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-slate-400">
              <a href="#features" className="transition hover:text-white">Features</a>
              <a href="#pricing" className="transition hover:text-white">Pricing</a>
              <Link href="/login" className="transition hover:text-white">Log in</Link>
              <Link href="/signup" className="transition hover:text-white">Get started</Link>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-white/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-500">© 2026 Hyntor. All rights reserved.</p>
            <div className="flex items-center gap-5 text-xs font-semibold text-slate-500">
              <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
              <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
