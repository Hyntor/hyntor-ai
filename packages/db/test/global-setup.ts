import { applySchema } from "../scripts/prisma";
import { resolveTestDatabaseUrl } from "./test-database";

// Runs once before the suite: bring the test database up to the current schema. Tests empty the tables
// themselves (helpers.deleteAllRows), so no destructive reset is needed here.
export default function setup(): void {
  process.env.DATABASE_URL = resolveTestDatabaseUrl();
  applySchema("migrate");
}
