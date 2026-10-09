// Derives the production Prisma schema (PostgreSQL) from the canonical
// dev schema (SQLite) so there is ONE source of truth for the data model.
//
// Local dev stays on SQLite (zero-install, see README). Production runs on
// PostgreSQL (Neon) - serverless hosts can't use a local SQLite file. The
// ONLY difference is the datasource provider, so we generate the prod
// schema by swapping that one line. Run by `npm run gen:prod-schema`
// (invoked automatically by `npm run vercel-build` and `db:push:prod`).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "packages", "db", "prisma", "schema.prisma");
const OUT = join(here, "..", "packages", "db", "prisma", "schema.prod.prisma");

const schema = readFileSync(SRC, "utf8");

if (!schema.includes('provider = "sqlite"')) {
  throw new Error(
    `Expected provider = "sqlite" in ${SRC}. If the dev provider changed, update gen-prod-schema.mjs.`
  );
}

const banner =
  "// GENERATED FILE - do not edit. Source: prisma/schema.prisma.\n" +
  "// Regenerate with `npm run gen:prod-schema`. Production (PostgreSQL) only.\n\n";

const prod = banner + schema.replace('provider = "sqlite"', 'provider = "postgresql"');

writeFileSync(OUT, prod);
console.log(`Wrote ${OUT} (provider: postgresql)`);
