// Authenticated app shell.
// Server component - redirects to /login when there's no session, so every
// page inside (app)/ can assume a logged-in user.
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { serverApi } from "@/lib/server-api";
import { Logo } from "@/components/ui";
import { SidebarNav } from "@/components/SidebarNav";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const apiCaller = await serverApi();
  const me = await apiCaller.user.me().catch(() => null);
  if (!me) redirect("/login");

  return (
    <div className="min-h-screen lg:flex">
      <aside className="relative z-20 border-b border-slate-200/70 bg-white/80 px-4 py-4 text-ink shadow-sm backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:py-6">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>
        <SidebarNav />
        <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-xl sm:grid-cols-[auto_1fr_auto] sm:items-center lg:mt-0 lg:block lg:space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span
              className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700"
              title="Daily study streak"
            >
              {me.streakCount} day{me.streakCount === 1 ? "" : "s"}
            </span>
            <span
              className="inline-flex items-center justify-center rounded-md bg-brand-50 px-2 py-1 font-semibold text-brand-700"
              title="Experience points"
            >
              {me.xp} XP
            </span>
          </div>
          {me.plan === "PRO" ? (
            <span className="inline-flex items-center justify-center rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white">
              Pro ✦
            </span>
          ) : (
            <Link
              href="/upgrade"
              className="inline-flex items-center justify-center rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              Upgrade to Pro ✦
            </Link>
          )}
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
            title="View your profile"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-[11px] font-semibold text-white">
              {initials(me.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{me.name}</span>
              <span className="block truncate text-xs text-slate-500">{me.university.name}</span>
            </span>
          </Link>
          <form
            className="sm:justify-self-end lg:block"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
