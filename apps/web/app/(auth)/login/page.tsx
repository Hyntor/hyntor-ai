"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");
    if (params.get("verified")) {
      setNotice("Email verified! Log in to continue.");
    }
    if (authError === "google_email") {
      setError("Google did not confirm a verified email address for this account.");
    } else if (authError) {
      setError("Google sign-in could not finish. Try again.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", { redirect: false, email, password });
    setBusy(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
      router.refresh();
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
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Log in to Hyntor</h1>
      <p className="mt-2 text-sm font-medium text-slate-500">Continue with Google or your email.</p>
      {notice && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{notice}</p>
      )}
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
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || googleBusy} className="btn-primary w-full">
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm font-medium text-slate-500">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs font-medium text-slate-400">
        Signed up but didn&apos;t get in?{" "}
        <Link href="/verify" className="font-semibold text-brand-600 hover:text-brand-700">
          Verify your email
        </Link>
      </p>
    </div>
  );
}
