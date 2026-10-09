import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our shared packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@coursemind/api", "@coursemind/db", "@coursemind/core"],
  // These native/Node-style packages break when bundled - keep them external.
  serverExternalPackages: ["@prisma/client", "pdf-parse", "mammoth", "jszip", "bcryptjs"],
};

export default nextConfig;
