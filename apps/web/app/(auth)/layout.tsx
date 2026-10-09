import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, FileText, MessagesSquare, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui";

// Auth shell: the bridge between the dark marketing site and the light app.
// Same visual language as the landing (dark surface, glow, shimmer) with the
// form on a clean light card - existing .input/.btn styles just work.

const POINTS = [
  { icon: FileText, text: "One shared library per course - notes, slides, homework" },
  { icon: ClipboardList, text: "Real past exams, inherited from past semesters" },
  { icon: MessagesSquare, text: "Live class group chat & discussion boards" },
  { icon: Sparkles, text: "AI that hints on graded work - never hands over answers" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060a14] text-white">
      {/* Glow field - same language as the landing hero. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="landing-orb left-[6%] top-[-8rem] h-[26rem] w-[26rem]" style={{ background: "rgba(10,132,255,0.28)" }} />
        <div className="landing-orb bottom-[-10rem] right-[8%] h-[24rem] w-[24rem]" style={{ background: "rgba(94,92,230,0.22)", animationDelay: "-7s" }} />
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 25%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 25%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_minmax(0,26.5rem)] lg:gap-16">
        {/* Brand panel */}
        <section className="hidden lg:block">
          <Link href="/" className="inline-block">
            <Logo dark />
          </Link>
          <h1 className="mt-10 max-w-lg font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            Don&apos;t just get the answer.
            <br />
            <span className="landing-shimmer">Actually learn it.</span>
          </h1>
          <p className="mt-5 max-w-md text-base font-medium leading-relaxed text-slate-400">
            Your class&apos;s materials, one shared library, and an AI that helps you understand them.
          </p>
          <div className="mt-10 grid max-w-md gap-3">
            {POINTS.map((p) => (
              <div
                key={p.text}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                  <p.icon size={15} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-slate-300">{p.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-xs font-medium text-slate-600">© 2026 Hyntor. All rights reserved.</p>
        </section>

        {/* Form card */}
        <section className="flex w-full flex-col items-center">
          <Link href="/" className="mb-8 lg:hidden">
            <Logo dark />
          </Link>
          <div className="w-full rounded-2xl border border-white/10 bg-white p-7 text-ink shadow-[0_30px_90px_-25px_rgba(10,132,255,0.5)] sm:p-8">
            {children}
          </div>
          <p className="mt-5 max-w-sm text-center text-xs font-medium leading-relaxed text-slate-500">
            By continuing you agree to Hyntor&apos;s{" "}
            <Link href="/terms" className="font-semibold text-slate-300 transition hover:text-white">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-slate-300 transition hover:text-white">Privacy Policy</Link>.
          </p>
          <p className="mt-3 text-center text-xs font-medium text-slate-500">
            <Link href="/" className="transition hover:text-slate-300">← Back to hyntor.vercel.app</Link>
          </p>
          {isDev && (
            <p className="mt-2 max-w-md text-center text-xs font-medium text-slate-600">
              Dev only - demo account: <span className="font-mono text-slate-400">alex@demo.edu</span> /{" "}
              <span className="font-mono text-slate-400">coursemind</span>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
