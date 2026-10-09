// NextAuth v5 configuration (web sessions).
// The actual credential check lives in @coursemind/api (verifyCredentials)
// so web and mobile share ONE auth implementation - this file only adapts
// it to NextAuth's session machinery.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { findOrCreateOAuthUser, isEmailConfigured, verifyCredentials } from "@coursemind/api";

type GoogleProfile = {
  email?: unknown;
  email_verified?: unknown;
};

function googleEmail(userEmail: string | null | undefined, profile: unknown): string | null {
  const profileEmail = (profile as GoogleProfile | undefined)?.email;
  if (typeof userEmail === "string" && userEmail.trim()) return userEmail;
  return typeof profileEmail === "string" && profileEmail.trim() ? profileEmail : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Trust the host header behind a proxy/host (e.g. Vercel) so sign-in works
  // in production without an UntrustedHost error. Safe here: the host is set
  // by the platform, not user input.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;
        const user = await verifyCredentials(email, password);
        if (!user) return null;
        // Only enforce email verification when a provider is configured. With
        // none, verification is paused and an outstanding code doesn't block.
        if (isEmailConfigured() && user.pendingCodeHash) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      // Google sign-in works for ANY email (personal or school). We only
      // require that Google itself confirmed the address.
      const email = googleEmail(user.email, profile);
      const verified = (profile as GoogleProfile | undefined)?.email_verified;
      if (!email || verified === false) return "/login?error=google_email";

      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const email = user?.email ?? token.email;
        if (typeof email === "string" && email.trim()) {
          const localUser = await findOrCreateOAuthUser({
            email,
            name: user?.name ?? (typeof token.name === "string" ? token.name : null),
            provider: "google",
          });
          token.uid = localUser.id;
          token.email = localUser.email;
          token.name = localUser.name;
        }
        return token;
      }

      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
