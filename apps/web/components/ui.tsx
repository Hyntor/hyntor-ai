import Link from "next/link";
import type { ReactNode } from "react";
import { TIER_LABELS } from "@coursemind/core";
import {
  BookOpen,
  Bug,
  ClipboardList,
  Code,
  FileText,
  FolderKanban,
  ListChecks,
  PencilLine,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The Hyntor mark: two pillars (two students) with a sheet passing between
 * them (the shared material). Reads as an "H" at any size.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hyntor-mark-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0a84ff" />
          <stop offset="1" stopColor="#005bb8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#hyntor-mark-g)" />
      <rect x="11" y="10" width="7" height="28" rx="3.5" fill="#ffffff" />
      <rect x="30" y="10" width="7" height="28" rx="3.5" fill="#ffffff" />
      <rect x="14.5" y="20.5" width="19" height="7" rx="2.5" fill="#a8d4ff" transform="rotate(-8 24 24)" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight ${
        dark ? "text-white" : "text-ink"
      }`}
    >
      <LogoMark className="h-8 w-8 drop-shadow-sm" />
      Hyntor
    </span>
  );
}

const TIER_STYLES: Record<number, string> = {
  0: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  1: "bg-brand-50 text-brand-700 ring-brand-100",
  2: "bg-slate-100 text-slate-700 ring-slate-200",
  3: "bg-amber-50 text-amber-700 ring-amber-100",
  4: "bg-coral-50 text-coral-500 ring-coral-100",
};

export function TierBadge({ tier }: { tier: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
        TIER_STYLES[tier] ?? TIER_STYLES[0]
      }`}
      title="Hyntor escalates hints only as you engage."
    >
      Tier {tier} - {TIER_LABELS[tier] ?? "Hint"}
    </span>
  );
}

export const MODE_META: Record<string, { label: string; icon: LucideIcon; blurb: string }> = {
  CONCEPT: {
    label: "Learn a concept",
    icon: Sparkles,
    blurb: "Full, generous explanations of anything in your course.",
  },
  ASSIGNMENT_HELP: {
    label: "Assignment help",
    icon: PencilLine,
    blurb: "Tiered hints that guide you to your own answer - never hand it over.",
  },
  CODE_REVIEW: {
    label: "Code review",
    icon: Code,
    blurb: "Paste homework code before submitting - get pointed questions, not rewrites.",
  },
  DEBUG: {
    label: "Debug with me",
    icon: Bug,
    blurb: "Step-by-step Socratic debugging of your code.",
  },
};

export function ModeBadge({ mode }: { mode: string }) {
  const meta = MODE_META[mode];
  const Icon = meta?.icon ?? Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {meta?.label ?? mode}
    </span>
  );
}

export const WORKSPACE_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  STUDY_GROUP: { label: "Study group", icon: Users },
  PROJECT: { label: "Project", icon: FolderKanban },
};

export function WorkspaceTypeBadge({ type }: { type: string }) {
  const meta = WORKSPACE_TYPE_META[type] ?? { label: type, icon: Users };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export const CONTEXT_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  COURSE: { label: "Course", icon: BookOpen },
  QUIZ: { label: "Quiz", icon: ListChecks },
  MATERIAL: { label: "Material", icon: FileText },
  EXAM: { label: "Exam", icon: ClipboardList },
};

export function ContextTypeBadge({ type }: { type: string }) {
  const meta = CONTEXT_TYPE_META[type] ?? { label: type, icon: BookOpen };
  const Icon = meta.icon;
  const style =
    type === "EXAM"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style}`}>
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function CrossUniversityBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100"
      title="Open to students from every university"
    >
      Global course
    </span>
  );
}

export function MaterialTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
      {type}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="card flex flex-col items-center py-12 text-center">
      <div className="mb-4 h-1.5 w-16 rounded-full bg-brand-600" />
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{body}</p>
      {cta && href && (
        <Link href={href} className="btn-primary mt-5">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-3">Hyntor</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
