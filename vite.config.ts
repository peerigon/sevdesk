import { resolve } from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

// Read directly from `process.env` rather than through a `src/env.ts` module:
// this is a library, and nothing under `src/` may read the environment (see
// AGENTS.md — the API token is passed to `createClient()` by the consumer).
const isCi = process.env["CI"] === "true" || process.env["CI"] === "1";

export default defineConfig({
  // Points at an empty directory so the unit test run never loads the repo root
  // `.env`. That is not cosmetic: 1Password Environments mounts `.env` as a
  // named pipe holding a production sevDesk token, and Vite loads `.env` from
  // `envDir` on its own — omitting `loadEnv()` here is not enough. Left at the
  // default, `npm test` would hand that token to unit tests that have no
  // business seeing it, and would block indefinitely whenever the pipe is
  // mounted but not being served (1Password locked, or authorization declined).
  //
  // Only vitest.smoke.config.ts is allowed to read `.env`.
  envDir: resolve(import.meta.dirname, "config/no-dotenv"),
  test: {
    // The smoke tests hit the live sevDesk API and need that token, so they are
    // excluded here and run only via `npm run smoke`.
    exclude: [...configDefaults.exclude, "**/smoke.test.ts"],
    coverage: {
      enabled: isCi,
      reporter: ["html", "lcov"],
      include: ["src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    },
  },
});
