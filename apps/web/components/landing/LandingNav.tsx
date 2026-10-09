"use client";

// Fixed marketing nav: transparent over the hero, gains a blurred glass
// background once the page scrolls.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

// Absolute /# anchors so the nav also works from /terms and /privacy.
const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#legacy", label: "The library" },
  { href: "/#tiers", label: "Hint tiers" },
  { href: "/#pricing", label: "Pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-[#060a14]/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo dark />
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#060a14] shadow-sm transition hover:bg-brand-100"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
