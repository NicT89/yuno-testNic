import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Silence multi-lockfile root inference when a parent package-lock exists.
  turbopack: {
    root: process.cwd(),
  },
  // Ensure the seeded SQLite file is bundled with every API serverless function.
  outputFileTracingIncludes: {
    "/*": ["./data/yuno-tax.db"],
  },
};

export default nextConfig;
