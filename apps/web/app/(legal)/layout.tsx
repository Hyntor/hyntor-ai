// Legal shell (/terms, /privacy): dark marketing surface with the content
// on a readable white "paper" card. Public pages - no auth.
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { LandingNav } from "@/components/landing/LandingNav";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060a14] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="landing-orb left-[10%] top-[-8rem] h-[24rem] w-[24rem]"
          style={{ background: "rgba(10,132,255,0.22)" }}
        />
        <div
          className="landing-orb bottom-[-10rem] right-[6%] h-[22rem] w-[22rem]"
          style={{ background: "rgba(94,92,230,0.16)", animationDelay: "-8s" }}
        />
      </div>

      <LandingNav />

      <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-28 lg:pt-32">
        <article className="rounded-2xl border border-white/10 bg-white p-7 text-ink shadow-[0_30px_90px_-25px_rgba(10,132,255,0.4)] sm:p-10">
          {children}
        </article>
      </div>

      <footer className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Logo dark />
          <div className="flex items-center gap-5 text-sm font-semibold text-slate-400">
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/" className="transition hover:text-white">Home</Link>
          </div>
        </div>
        <p className="mx-auto max-w-3xl px-6 pb-8 text-xs font-medium text-slate-600">
          © 2026 Hyntor. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
