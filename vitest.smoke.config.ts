import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Config for `npm run smoke` — the tests that hit the live sevDesk API.
 *
 * Kept separate from `vite.config.ts` so the default test run can never reach the network, never
 * needs a token, and never triggers a 1Password prompt.
 *
 * The token reaches the tests one of two ways, and `loadEnv` covers both:
 *
 * - **Locally**: `.env` is mounted by 1Password Environments as a named pipe, which `loadEnv` reads
 *   like any dotenv file. The value is served on demand and never written to disk.
 * - **In CI**: `op run --environment "$OP_ENVIRONMENT_ID" -- npm run smoke` puts it in `process.env`,
 *   where `loadEnv` also picks it up. There is no `.env` file on the runner.
 *
 * The `SEVDESK_` prefix is what keeps this narrow: only sevDesk variables are lifted into the test
 * environment, so an Environment that also carries unrelated secrets does not spill them into the
 * test process.
 */
export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, import.meta.dirname, "SEVDESK_"),
    include: ["src/tests/smoke.test.ts"],
    // Real network calls against a production account; the default 5s is tight.
    testTimeout: 30_000,
    // Sequential, to stay gentle on the API's rate limit.
    fileParallelism: false,
    coverage: { enabled: false },
  },
}));
