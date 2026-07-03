"use client";

// App sidebar navigation with active-route highlighting (client component -
// the shell layout stays a server component).
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Code,
  GraduationCap,
  LayoutDashboard,
  Network,
  Sparkles,
  Terminal,
  Trophy,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/tutor", label: "AI Tutor", icon: Sparkles },
  { href: "/code-review", label: "Code Review", icon: Code },
  { href: "/sandbox", label: "Sandbox", icon: Terminal },
  { href: "/visualizer", label: "Visualizer", icon: Network },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 grid grid-cols-2 gap-2 pb-1 sm:flex sm:gap-1 sm:overflow-x-auto lg:mt-8 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-visible lg:pb-0">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-700 hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <span
              className={`grid h-7 w-7 place-items-center rounded-md transition ${
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              <item.icon size={15} strokeWidth={2} aria-hidden="true" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
