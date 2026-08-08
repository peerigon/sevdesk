import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

// Read directly from `process.env` rather than through a `src/env.ts` module:
// this is a library, and nothing under `src/` may read the environment (see
// AGENTS.md — the API token is passed to `createClient()` by the consumer).
const isCi = process.env["CI"] === "true" || process.env["CI"] === "1";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, import.meta.dirname, ""),
    // The smoke tests hit the live sevDesk API and need a token. `npm test` must
    // never depend on either, so they only run via `npm run smoke`
    // (vitest.smoke.config.ts).
    exclude: [...configDefaults.exclude, "**/smoke.test.ts"],
    coverage: {
      enabled: isCi,
      reporter: ["html", "lcov"],
      include: ["src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    },
  },
}));
