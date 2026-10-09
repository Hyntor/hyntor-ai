// tRPC initialization: context + base procedures.
// The context resolves WHO is calling from either transport:
//   - web: the Next.js route handler passes sessionUserId (from NextAuth)
//   - mobile: an "Authorization: Bearer <jwt>" header (verified here)
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { prisma } from "@coursemind/db";
import { verifyMobileToken } from "./auth";

export interface CreateContextOptions {
  /** From NextAuth on web; null for anonymous/mobile requests. */
  sessionUserId: string | null;
  /** Raw Authorization header, if any (mobile JWT). */
  authorizationHeader: string | null;
}

export async function createContext(opts: CreateContextOptions) {
  let userId = opts.sessionUserId;
  if (!userId && opts.authorizationHeader?.startsWith("Bearer ")) {
    userId = await verifyMobileToken(opts.authorizationHeader.slice("Bearer ".length));
  }
  return { prisma, userId };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to continue." });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Throws unless the user is a member of the workspace. Returns the membership. */
export async function requireWorkspaceMember(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You need to join this workspace first.",
    });
  }
  return member;
}

/** Throws unless the user is enrolled in the course. Returns the enrollment. */
export async function requireEnrollment(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You need to join this course first.",
    });
  }
  return enrollment;
}
