import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Read directly from `process.env` rather than through a `src/env.ts` module:
// this is a library, and nothing under `src/` may read the environment (see
// AGENTS.md — the API token is passed to `createClient()` by the consumer).
const isCi = process.env["CI"] === "true" || process.env["CI"] === "1";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, import.meta.dirname, ""),
    coverage: {
      enabled: isCi,
      reporter: ["html", "lcov"],
      include: ["src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    },
  },
}));
