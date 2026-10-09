"use client";

// Account profile: who you are, how you signed in, and your activity stats.
// Display name is editable inline.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";

type Profile = Awaited<ReturnType<typeof api.user.profile.query>>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.user.profile.query();
      setProfile(data);
      setName(data.name);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.user.updateProfile.mutate({ name: trimmed });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await load();
      router.refresh(); // update the name shown in the sidebar
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!profile && !error) {
    return <p className="py-12 text-center text-sm font-medium text-slate-400">Loading profile...</p>;
  }
  if (error && !profile) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  const p = profile!;
  const roleLabel = p.role === "TA" ? "Teaching assistant" : p.role === "INSTRUCTOR" ? "Instructor" : "Student";
  const stats = [
    { label: "XP", value: p.xp },
    { label: "Day streak", value: p.streakCount },
    { label: "Courses", value: p.stats.courses },
    { label: "Materials shared", value: p.stats.materialsShared },
    { label: "Quizzes taken", value: p.stats.quizzesTaken },
    { label: "Tutor sessions", value: p.stats.tutorSessions },
  ];

  return (
    <div>
      <PageHeader title="Your profile" subtitle="Your account, how you sign in, and your activity on Hyntor." />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {/* Identity card */}
      <div className="card flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-600 font-display text-2xl font-semibold text-white shadow-sm">
          {initials(p.name)}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="input max-w-xs"
                value={name}
                maxLength={100}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setName(p.name);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-semibold text-ink">{p.name}</h2>
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Edit name
              </button>
              {saved && <span className="text-sm font-medium text-emerald-600">Saved</span>}
            </div>
          )}
          <p className="mt-1 text-sm font-medium text-slate-500">{p.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              {roleLabel}
            </span>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
              {p.space.name}
            </span>
            {p.plan === "PRO" ? (
              <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">Pro ✦</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">Free</span>
            )}
            {p.emailVerified && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Email verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-ink">Your activity</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="metric-tile">
            <p className="font-display text-2xl font-semibold text-ink">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Account details */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-ink">Account</h2>
      <div className="surface-panel divide-y divide-slate-100/80 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <span className="text-sm font-medium text-slate-500">Plan</span>
          <span className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink">{p.plan === "PRO" ? "Pro ✦" : "Free"}</span>
            <Link href="/upgrade" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              {p.plan === "PRO" ? "Manage" : "Upgrade"}
            </Link>
          </span>
        </div>
        <Row label="Sign-in method" value={p.signInMethod === "google" ? "Google" : "Email & password"} />
        <Row label="Study space" value={p.space.name} />
        <Row label="Member since" value={new Date(p.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
      </div>

      <p className="mt-6 text-sm font-medium text-slate-500">
        Want to climb the ranks?{" "}
        <Link href="/leaderboard" className="font-semibold text-brand-600 hover:text-brand-700">
          See the leaderboard
        </Link>
        .
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
