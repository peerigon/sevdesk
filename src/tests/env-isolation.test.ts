import { readdirSync } from "node:fs";
import { basename } from "node:path";

import { describe, expect, it } from "vitest";

import unitConfig from "../../vite.config.ts";
import smokeConfig from "../../vitest.smoke.config.ts";

/**
 * Guards the boundary that keeps a production credential out of the unit tests.
 *
 * `.env` is mounted by 1Password Environments as a named pipe holding a production sevDesk token,
 * and Vite loads `.env` from `envDir` on its own — omitting `loadEnv()` is not enough. So
 * `vite.config.ts` points `envDir` at an empty directory. Undo that and every `npm test` pops a
 * 1Password authorization prompt, and blocks forever whenever the pipe is mounted but not being
 * served (1Password locked, or authorization declined).
 *
 * This asserts the config, because the effect it prevents cannot be observed from inside a passing
 * test run — by the time a test executes, the read has either already happened or already hung.
 */
describe("unit test environment", () => {
  it("points envDir at a directory with no env files, so .env is never read", () => {
    const { envDir } = unitConfig;

    expect(envDir).toBeTypeOf("string");
    expect(basename(envDir as string)).toBe("no-dotenv");

    const envFiles = readdirSync(envDir as string).filter((file) => file.startsWith(".env"));

    expect(envFiles).toStrictEqual([]);
  });

  it("excludes the smoke tests, which are the only tests allowed a token", () => {
    expect(unitConfig.test?.exclude).toContain("**/smoke.test.ts");
  });

  it("leaves the smoke config free to read .env from the repo root", () => {
    // The counterpart to the rule above: `npm run smoke` must still find the mounted file.
    const resolved =
      typeof smokeConfig === "function"
        ? smokeConfig({ command: "serve", mode: "test" })
        : smokeConfig;

    expect(resolved.envDir).toBeUndefined();
    expect(resolved.test?.include).toStrictEqual(["src/tests/smoke.test.ts"]);
  });
});
