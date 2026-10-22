import { 
  createHash 
} from "node:crypto";
import { 
  prisma 
} from "@hyntor/db";

const SESSION_COOKIE = "session"; // confirm this against the login code.

async function resolveUser(req: Request) {
  const raw = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  if (!raw) return null;
  const tokenHash = createHash("sha256").update(raw).digest("hex"); // has to match whatever the login flow uses (sha256 is a guess). If something else is picked, CHANGE.
  const session = await prisma.session.findUnique({
    where: { 
      tokenHash 
    },
    select: {
      expiresAt: true,
      user: { select: { id: true, universityId: true, displayName: true, platformRole: true, emailVerifiedAt: true } },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function createContext({ req }: { req: Request }) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const user = await resolveUser(req);
  const log = logger.child({ requestId, userId: user?.id ?? null });
  return { requestId, user, log, db: prisma };
