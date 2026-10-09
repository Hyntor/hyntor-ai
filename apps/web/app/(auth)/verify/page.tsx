"use client";

// Email verification: enter the 6-digit code sent at signup. On success we
// send the user to /login to sign in (we never carry their password here).
// When no email provider is configured, signup passes the code through
// sessionStorage so the flow is still testable - shown in a "dev mode" banner.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/trpc";

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    const stashed = window.sessionStorage.getItem("hyntor.devCode");
    if (stashed) setDevCode(stashed);
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.user.verifyEmail.mutate({ email, code: code.trim() });
      window.sessionStorage.removeItem("hyntor.devCode");
      router.push("/login?verified=1");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.user.resendCode.mutate({ email });
      if (result.devCode) {
        window.sessionStorage.setItem("hyntor.devCode", result.devCode);
        setDevCode(result.devCode);
        setNotice("A new code was generated (dev mode - shown below).");
      } else {
        setNotice("If that account still needs verifying, a new code is on its way.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">Almost there</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Verify your email</h1>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
        We sent a 6-digit code to{" "}
        <span className="font-semibold text-ink">{email || "your email"}</span>. Enter it below to
        finish creating your account.
      </p>

      {devCode && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Email isn&apos;t configured yet (dev mode)</p>
          <p className="mt-1">
            Your code is{" "}
            <span className="font-mono text-base font-bold tracking-widest">{devCode}</span>. Set{" "}
            <code className="rounded bg-white/70 px-1">RESEND_API_KEY</code> to email codes for real.
          </p>
        </div>
      )}

      <form onSubmit={handleVerify} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="code">Verification code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="input text-center text-lg font-semibold tracking-[0.5em]"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
        {notice && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">{notice}</p>}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || code.length < 4} className="btn-primary w-full">
          {busy ? "Verifying..." : "Verify and continue"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm font-medium text-slate-500">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || !email}
          className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          {resending ? "Sending..." : "Resend code"}
        </button>
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to log in
        </Link>
      </div>
    </div>
  );
}
