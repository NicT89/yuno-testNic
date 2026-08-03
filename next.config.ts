import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Silence multi-lockfile root inference when a parent package-lock exists.
  turbopack: {
    root: process.cwd(),
  },
  // Ensure the seeded SQLite file and the fixtures are bundled with every API
  // serverless function. The schema is only needed at seed time.
  outputFileTracingIncludes: {
    "/*": ["./data/yuno-tax.db", "./data/transactions.json"],
  },
};

export default nextConfig;
