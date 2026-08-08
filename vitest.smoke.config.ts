import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Config for `npm run smoke` — the tests that hit the live sevDesk API.
 *
 * Kept separate from `vite.config.ts` so the default test run can never reach the network, and so
 * the smoke tests can be given a longer timeout without slowing the unit tests down.
 */
export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, import.meta.dirname, ""),
    include: ["src/tests/smoke.test.ts"],
    // Real network calls against a production account; the default 5s is tight.
    testTimeout: 30_000,
    // Sequential, to stay gentle on the API's rate limit.
    fileParallelism: false,
    coverage: { enabled: false },
  },
}));
