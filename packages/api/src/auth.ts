// Shared auth logic for BOTH platforms:
//  - Web: NextAuth's Credentials provider calls verifyCredentials()
//  - Mobile: POST /api/mobile/login calls verifyCredentials() then
//    signMobileToken(); every later request sends "Authorization: Bearer <jwt>"
// One user store, one password check, two transport mechanisms.
import crypto from "crypto";
import { promises as dns } from "dns";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@coursemind/db";
import { EMAIL_CODE_LENGTH, EMAIL_CODE_TTL_MINUTES } from "@coursemind/core";
import { lookupUniversityName } from "./universities";

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const OAUTH_ONLY_PASSWORD_HASH = "oauth:google";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Run `npm run setup` to generate env files, or add AUTH_SECRET to apps/web/.env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export function schoolDomainFromEmail(email: string): string | null {
  const normalized = email.toLowerCase().trim();
  const domain = normalized.split("@")[1]?.trim();
  return domain && domain.includes(".") ? domain : null;
}

export function isPersonalEmailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase().trim());
}

export function prettifyDomain(domain: string): string {
  const base = domain.split(".")[0];
  return `${base.charAt(0).toUpperCase()}${base.slice(1)} (${domain})`;
}

// ---------- Email deliverability (DNS) ----------
// Ownership can only be PROVEN by the emailed code (needs RESEND_API_KEY),
// but we can always catch made-up domains and typos at signup: a real email
// address lives on a domain with mail setup. Policy:
//   - domain has MX records (or an A/AAAA record - RFC 5321 fallback) -> OK
//   - domain doesn't resolve / has no mail setup (ENOTFOUND/ENODATA) -> reject
//   - DNS timeout or transient failure -> ALLOW (fail-open: never block a
//     real student because DNS hiccuped)

const DNS_TIMEOUT_MS = 4000;

function withDnsTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("DNS lookup timed out"), { code: "ETIMEOUT" })),
      DNS_TIMEOUT_MS
    );
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function isNoSuchDomain(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === "ENOTFOUND" || code === "ENODATA";
}

export async function emailDomainReceivesMail(domain: string): Promise<boolean> {
  // Preferred signal: MX records (uses the network resolver, c-ares).
  // ANY failure - no such domain, zero MX, resolver unreachable - falls
  // through to the OS-resolver existence check below, which is a different
  // resolution path (getaddrinfo: system DNS, hosts file, VPN) and often
  // works where raw DNS is blocked.
  try {
    const mx = await withDnsTimeout(dns.resolveMx(domain));
    if (mx.length > 0) return true;
  } catch {
    // fall through
  }
  // Existence check: a domain that exists but publishes no MX can still
  // receive mail on its apex (RFC 5321), so existence = lenient pass;
  // ENOTFOUND = definite reject; anything else (timeout, weird resolver
  // state) fails open so a real student is never blocked by flaky DNS.
  try {
    await withDnsTimeout(dns.lookup(domain));
    return true;
  } catch (err) {
    return !isNoSuchDomain(err);
  }
}

function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart
    .split(/[._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "Student";
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return null;
  if (user.passwordHash === OAUTH_ONLY_PASSWORD_HASH) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export interface SignupInput {
  email: string;
  name: string;
  password: string;
}

const PERSONAL_SPACE_NAME = "Independent learners";

/**
 * Resolve which University a signup belongs to.
 * - School domains SHARE a university (that's the "school graph" - classmates
 *   discover each other's courses and materials).
 * - Personal / free-mail addresses each get their OWN isolated space, keyed by
 *   the full email, so strangers don't share a course library just because
 *   they both happen to use Gmail.
 */
async function resolveUniversityId(normalizedEmail: string, domain: string): Promise<string> {
  const personal = isPersonalEmailDomain(domain);
  const key = personal ? `personal:${normalizedEmail}` : domain;
  // Known school domains get their REAL name ("stanford.edu" -> "Stanford
  // University"); unknown ones keep the readable fallback label.
  const known = personal ? null : lookupUniversityName(domain);
  const name = personal ? PERSONAL_SPACE_NAME : (known ?? prettifyDomain(domain));
  const university = await prisma.university.upsert({
    where: { emailDomain: key },
    // Self-heal rows created before the school was in the dataset - but only
    // with authoritative names, never overwriting hand-named spaces.
    update: known ? { name: known } : {},
    create: { name, emailDomain: key },
  });
  return university.id;
}

export async function signupUser({ email, name, password }: SignupInput) {
  const normalized = email.toLowerCase().trim();
  const domain = schoolDomainFromEmail(normalized);
  if (!domain) throw new Error("Please enter a valid email address.");

  // Known free-mail providers obviously receive mail - skip the DNS lookup.
  if (!isPersonalEmailDomain(domain) && !(await emailDomainReceivesMail(domain))) {
    throw new Error(
      `"${domain}" doesn't appear to be a real email domain. Double-check for typos - use your actual school or personal email address.`
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    // Signed up before but never verified? Let them through to re-request a
    // code instead of hard-blocking on "already exists".
    if (existing.pendingCodeHash && !existing.emailVerified) return existing;
    throw new Error("An account with this email already exists. Try logging in instead.");
  }

  const universityId = await resolveUniversityId(normalized, domain);
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email: normalized, name: name.trim(), passwordHash, universityId },
  });
}

// ---------- Email verification (code-based) ----------

function generateNumericCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += (bytes[i] % 10).toString();
  return code;
}

/** Generate a fresh code, store its hash + expiry on the user, return the
 *  plaintext code for the caller to email. */
export async function issueEmailCode(userId: string): Promise<string> {
  const code = generateNumericCode(EMAIL_CODE_LENGTH);
  const pendingCodeHash = await bcrypt.hash(code, 10);
  const pendingCodeExpiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { pendingCodeHash, pendingCodeExpiresAt },
  });
  return code;
}

/** Check a submitted code; on success mark the email verified and clear the
 *  pending code. Returns false for wrong/expired/missing codes. */
export async function checkEmailCode(email: string, code: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.pendingCodeHash || !user.pendingCodeExpiresAt) return false;
  if (user.pendingCodeExpiresAt.getTime() < Date.now()) return false;
  const ok = await bcrypt.compare(code.trim(), user.pendingCodeHash);
  if (!ok) return false;
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), pendingCodeHash: null, pendingCodeExpiresAt: null },
  });
  return true;
}

export interface OAuthSignupInput {
  email: string;
  name?: string | null;
  provider: "google";
}

export async function findOrCreateOAuthUser({ email, name }: OAuthSignupInput) {
  const normalized = email.toLowerCase().trim();
  const domain = schoolDomainFromEmail(normalized);
  if (!domain) throw new Error("Google did not return a valid email address.");

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    // Google has already verified this email, so a Google sign-in also clears
    // any outstanding email-code gate from an earlier password signup.
    if (!existing.emailVerified || existing.pendingCodeHash) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: existing.emailVerified ?? new Date(), pendingCodeHash: null, pendingCodeExpiresAt: null },
      });
    }
    return existing;
  }

  const universityId = await resolveUniversityId(normalized, domain);
  const cleanName = name?.trim() || displayNameFromEmail(normalized);
  return prisma.user.create({
    data: {
      email: normalized,
      name: cleanName,
      passwordHash: OAUTH_ONLY_PASSWORD_HASH,
      universityId,
      emailVerified: new Date(), // Google-verified
    },
  });
}

// ---------- Mobile JWT ----------

const MOBILE_TOKEN_TTL = "30d";

export async function signMobileToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, platform: "mobile" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyMobileToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
