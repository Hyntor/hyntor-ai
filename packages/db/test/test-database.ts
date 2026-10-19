import { isSqliteUrl, loadRootEnv, resolveDatabaseUrl } from "../src/env";

/**
 * The database the tests may wipe. TEST_DATABASE_URL wins; with a SQLite DATABASE_URL the tests use
 * ./test.db next to it. A PostgreSQL DATABASE_URL is never reused, so `npm test` cannot wipe real data.
 */
export function resolveTestDatabaseUrl(): string {
  loadRootEnv();
  const appUrl = resolveDatabaseUrl();
  const explicit = process.env.TEST_DATABASE_URL;

  if (explicit) {
    if (appUrl && isSqliteUrl(appUrl) !== isSqliteUrl(explicit)) {
      // The generated Prisma client only speaks the provider DATABASE_URL had at generate time.
      throw new Error("TEST_DATABASE_URL and DATABASE_URL must use the same provider (ADR-0002)");
    }
    return resolveDatabaseUrl(explicit) ?? explicit;
  }
  if (appUrl && isSqliteUrl(appUrl)) return resolveDatabaseUrl("file:./test.db") ?? "file:./test.db";
  throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database; tests wipe it.");
}
