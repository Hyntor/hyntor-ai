import { defineConfig } from "vitest/config";

import { resolveTestDatabaseUrl } from "./test/test-database";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    env: { DATABASE_URL: resolveTestDatabaseUrl() },
    // Every file shares one database, so files run one at a time.
    fileParallelism: false,
  },
});
