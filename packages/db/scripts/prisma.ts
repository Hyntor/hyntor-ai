// Runs the Prisma CLI against the right schema for DATABASE_URL (ADR-0002).
//   generate                 generate the client for the current provider
//   migrate                  PostgreSQL: apply committed migrations; SQLite: push the schema
//   migration:create <name>  write a new migration (PostgreSQL only)
//   reset                    drop everything and re-apply the schema (data is lost)
//   studio                   open Prisma Studio
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isSqliteUrl, loadRootEnv, resolveDatabaseUrl } from "../src/env";

const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma");
const schemaFile = path.join(prismaDir, "schema.prisma");
const sqliteSchemaFile = path.join(prismaDir, ".generated", "schema.sqlite.prisma");

function writeSqliteSchema(): string {
  const source = fs.readFileSync(schemaFile, "utf8");
  const providerLine = /provider\s*=\s*"postgresql"/g;
  if ((source.match(providerLine) ?? []).length !== 1) {
    throw new Error(`Expected exactly one provider = "postgresql" line in ${schemaFile}`);
  }
  fs.mkdirSync(path.dirname(sqliteSchemaFile), { recursive: true });
  fs.writeFileSync(
    sqliteSchemaFile,
    `// GENERATED from ../schema.prisma by scripts/prisma.ts. Do not edit.\n${source.replace(providerLine, 'provider = "sqlite"')}`,
  );
  return sqliteSchemaFile;
}

function runPrisma(args: string[], databaseUrl: string): void {
  const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function applySchema(command: "migrate" | "reset"): void {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (isSqliteUrl(url)) {
    const schema = writeSqliteSchema();
    const reset = command === "reset" ? ["--force-reset"] : [];
    runPrisma(["db", "push", "--schema", schema, "--skip-generate", ...reset], url);
  } else if (command === "reset") {
    runPrisma(["migrate", "reset", "--schema", schemaFile, "--force", "--skip-seed", "--skip-generate"], url);
  } else {
    runPrisma(["migrate", "deploy", "--schema", schemaFile], url);
  }
}

function main(): void {
  loadRootEnv();
  const [command, ...rest] = process.argv.slice(2);
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env (see README).");
    process.exit(1);
  }
  const sqlite = isSqliteUrl(url);
  const schema = sqlite ? writeSqliteSchema() : schemaFile;

  switch (command) {
    case "generate":
      runPrisma(["generate", "--schema", schema], url);
      break;
    case "migrate":
    case "reset":
      applySchema(command);
      break;
    case "migration:create": {
      const name = rest[0];
      if (!name) {
        console.error("Usage: npm run db:migration:create -- <name>");
        process.exit(1);
      }
      if (sqlite) {
        console.error(
          "Migrations are PostgreSQL SQL; point DATABASE_URL at PostgreSQL to create one (ADR-0002).",
        );
        process.exit(1);
      }
      runPrisma(["migrate", "dev", "--schema", schema, "--create-only", "--name", name], url);
      break;
    }
    case "studio":
      runPrisma(["studio", "--schema", schema], url);
      break;
    default:
      console.error(
        `Unknown command "${command ?? ""}". See the header of ${path.basename(import.meta.url)}.`,
      );
      process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
