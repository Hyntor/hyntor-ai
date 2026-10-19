import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// One .env at the repository root serves the app, the Prisma scripts and the tests.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not build output (ADR-0001).
  transpilePackages: ["@hyntor/api", "@hyntor/core", "@hyntor/db"],
  // `npm run lint` at the root lints every workspace with one config; `next build` does not lint again.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
