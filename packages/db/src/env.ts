import fs from "node:fs";
import path from "node:path";

export const DEFAULT_DEV_DATABASE_URL = "file:./dev.db";

/** Walks up from `start` to the directory whose package.json declares the npm workspaces. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, "utf8")) as { workspaces?: unknown };
      if (pkg.workspaces) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`No workspace root found above ${start}`);
    dir = parent;
  }
}

/** Loads the repository's root .env, if there is one. Variables already set are not overridden. */
export function loadRootEnv(): void {
  const file = path.join(findRepoRoot(), ".env");
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

/**
 * DATABASE_URL with relative SQLite paths made absolute against the repository root, so the CLI, the app
 * and the tests all open the same file whatever their working directory (ADR-0002).
 * Unset falls back to the dev SQLite file, except in production where Prisma reports the missing variable.
 */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL): string | undefined {
  const url = raw ?? (process.env.NODE_ENV === "production" ? undefined : DEFAULT_DEV_DATABASE_URL);
  if (!url?.startsWith("file:")) return url;

  const filePath = url.slice("file:".length);
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(findRepoRoot(), filePath);
  return `file:${absolute.replaceAll("\\", "/")}`;
}

/** Root of LocalFileStore (ADR-0005): STORAGE_DIR, relative to the repository root, default `.storage`. */
export function resolveStorageDir(raw = process.env.STORAGE_DIR): string {
  return path.resolve(findRepoRoot(), raw || ".storage");
}

export function isSqliteUrl(url: string): boolean {
  return url.startsWith("file:");
}
