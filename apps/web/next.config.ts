import path from "node:path";
import type { NextConfig } from "next";

/**
 * Workspace packages export TypeScript source, so Next.js compiles them and they have no
 * build step. The Turbopack root is the repository root, not a parent folder that has its
 * own workspace file.
 */
const config: NextConfig = {
  transpilePackages: ["@bellaso/core", "@bellaso/chain"],
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
  },
};

export default config;
