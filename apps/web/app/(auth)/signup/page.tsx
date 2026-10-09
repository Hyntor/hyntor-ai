"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { api, errorMessage } from "@/lib/trpc";

type SchoolPreview = Awaited<ReturnType<typeof api.user.schoolPreview.query>>;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolPreview, setSchoolPreview] = useState<SchoolPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setSchoolPreview(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const preview = await api.user.schoolPreview.query({ email: trimmed });
        if (active) setSchoolPreview(preview);
      } catch {
        if (active) setSchoolPreview(null);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.user.signup.mutate({ name, email, password });
      if (!result.verificationRequired) {
        // Email verification is paused (no provider configured): log straight in.
        const signInResult = await signIn("credentials", { redirect: false, email, password });
        if (signInResult?.error) {
          router.push("/login");
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }
      // Verification on: stash any dev code and continue to the verify screen.
      if (result.devCode) {
        window.sessionStorage.setItem("hyntor.devCode", result.devCode);
      } else {
        window.sessionStorage.removeItem("hyntor.devCode");
      }
      router.push(`/verify?email=${encodeURIComponent(result.email)}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Google sign-in is not configured yet.");
      setGoogleBusy(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">Start studying</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
        Use your school email to connect with classmates and shared materials, or a personal email
        for your own private study space.
      </p>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy || googleBusy}
        className="btn-secondary mt-6 w-full"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white font-display text-xs font-semibold text-ink ring-1 ring-slate-200">
          G
        </span>
        {googleBusy ? "Opening Google..." : "Continue with Google"}
      </button>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input
            id="name"
            required
            className="input"
            placeholder="Alex Demo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            className="input"
            placeholder="you@school.edu or you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {(previewLoading || schoolPreview) && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                schoolPreview?.status === "personal_email"
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-brand-100 bg-brand-50 text-brand-800"
              }`}
            >
              {previewLoading ? (
                <p className="font-semibold">Checking school domain...</p>
              ) : schoolPreview ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {schoolPreview.schoolName ?? schoolPreview.message}
                    </p>
                    {schoolPreview.domain && (
                      <span className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] font-semibold">
                        {schoolPreview.domain}
                      </span>
                    )}
                  </div>
                  {schoolPreview.status === "recognized" ? (
                    <p className="mt-1 text-xs font-medium">
                      {schoolPreview.courseCount} related course{schoolPreview.courseCount === 1 ? "" : "s"} and{" "}
                      {schoolPreview.resourceCount} shared resource{schoolPreview.resourceCount === 1 ? "" : "s"} found.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium">{schoolPreview.message}</p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="password">Password (8+ characters)</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || googleBusy} className="btn-primary w-full">
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm font-medium text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </div>
  );
}
