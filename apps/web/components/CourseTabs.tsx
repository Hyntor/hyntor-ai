"use client";

// Persistent tab bar for everything inside one course - so students always
// know where they are and can hop between the library, chat, and study
// tools without hunting for "back" links.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  MessageCircle,
  MessagesSquare,
  Upload,
  Users,
} from "lucide-react";

const TABS = [
  { segment: "", label: "Overview", icon: BookOpen },
  { segment: "chat", label: "Group chat", icon: MessagesSquare },
  { segment: "discussions", label: "Discussions", icon: MessageCircle },
  { segment: "workspaces", label: "Workspaces", icon: Users },
  { segment: "study", label: "Smart study", icon: CalendarCheck },
  { segment: "upload", label: "Upload", icon: Upload },
];

export function CourseTabs({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/courses/${courseId}`;

  return (
    <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200/70 bg-white/80 p-1.5 shadow-card backdrop-blur-xl">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <tab.icon size={14} strokeWidth={2.2} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
