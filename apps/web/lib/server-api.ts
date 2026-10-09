// In-process API caller for React Server Components - same routers,
// no HTTP hop. Always reflects the logged-in NextAuth session.
import { appRouter, createContext } from "@coursemind/api";
import { auth } from "@/auth";

export async function serverApi() {
  const session = await auth();
  const ctx = await createContext({
    sessionUserId: session?.user?.id ?? null,
    authorizationHeader: null,
  });
  return appRouter.createCaller(ctx);
}
