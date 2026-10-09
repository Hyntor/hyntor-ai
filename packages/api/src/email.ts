// Transactional email. ALL email in the product goes through here so that:
//  - the provider lives in one place,
//  - a missing key degrades gracefully (like the AI features),
//  - we never add an npm dependency (Resend is called over its REST API).
//
// Provider: Resend (https://resend.com). Set RESEND_API_KEY to send real
// mail; optionally EMAIL_FROM (defaults to Resend's shared onboarding
// sender). With no key, sendVerificationEmail logs the code server-side and
// reports delivered:false so the caller can fall back to a dev flow.
import { EMAIL_CODE_TTL_MINUTES } from "@coursemind/core";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const DEFAULT_FROM = "Hyntor <onboarding@resend.dev>";

function verificationHtml(code: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 8px">Confirm your email</h1>
  <p style="color:#475569;font-size:14px;margin:0 0 20px">Enter this code in Hyntor to finish creating your account.</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#eef2ff;color:#3730a3;border-radius:12px;padding:16px;text-align:center">${code}</div>
  <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">This code expires in ${EMAIL_CODE_TTL_MINUTES} minutes. If you didn't sign up for Hyntor, you can ignore this email.</p>
</div>`;
}

/**
 * Send a verification code. Returns delivered:false (instead of throwing)
 * when no provider is configured, so signup can fall back to showing the
 * code in a clearly-marked dev mode.
 */
export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<{ delivered: boolean }> {
  if (!isEmailConfigured()) {
    console.log(`[email:dev] Verification code for ${to}: ${code}`);
    return { delivered: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      subject: `Your Hyntor verification code: ${code}`,
      html: verificationHtml(code),
      text: `Your Hyntor verification code is ${code}. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] Resend send failed (${res.status}): ${detail}`);
    throw new Error("We couldn't send your verification email just now. Please try again in a moment.");
  }
  return { delivered: true };
}
