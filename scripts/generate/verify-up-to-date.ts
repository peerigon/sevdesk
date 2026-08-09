import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { emitExports } from "./emit.ts";
import { generate } from "./main.ts";
import { generatedDir, jsonPath, packageJsonPath } from "./paths.ts";

/**
 * Fails when `src/generated/` or either `exports` map has drifted from the committed spec — i.e.
 * generated code was edited by hand, or the generator changed without being re-run.
 *
 * Regenerates into a temp directory and formats it exactly like `npm run generate` does, so the
 * comparison is against the same bytes that land in the repo. Nothing in the working tree is
 * touched, which keeps this safe to run in parallel with the other `test:*` scripts.
 */
const workDir = mkdtempSync(join(tmpdir(), "sevdesk-generate-"));

try {
  const { moduleNames } = generate(workDir);

  // Twice, mirroring `generate:format`: oxfmt's JSDoc reflow needs a second pass
  // to reach a fixed point, and this has to match the committed bytes exactly.
  execFileSync("npx", ["oxfmt", "--write", workDir], { stdio: "pipe" });
  execFileSync("npx", ["oxfmt", "--write", workDir], { stdio: "pipe" });

  const problems: Array<string> = [];
  const expectedFiles = readdirSync(workDir);
  const actualFiles = readdirSync(generatedDir).filter((file) => file !== "api.ts");

  for (const file of expectedFiles) {
    const expected = readFileSync(join(workDir, file), "utf8");
    const actual = (() => {
      try {
        return readFileSync(join(generatedDir, file), "utf8");
      } catch {
        return undefined;
      }
    })();

    if (actual === undefined) {
      problems.push(`src/generated/${file} is missing`);
    } else if (actual !== expected) {
      problems.push(`src/generated/${file} differs from the spec`);
    }
  }

  for (const file of actualFiles) {
    if (!expectedFiles.includes(file)) {
      problems.push(`src/generated/${file} is stale — no tag produces it any more`);
    }
  }

  for (const [path, jsr, label] of [
    [packageJsonPath, false, "package.json"],
    [jsonPath, true, "jsr.json"],
  ] as const) {
    const manifest = JSON.parse(readFileSync(path, "utf8")) as { exports?: unknown };

    // Compared as parsed JSON, so this is independent of formatting.
    if (JSON.stringify(manifest.exports) !== JSON.stringify(emitExports(moduleNames, { jsr }))) {
      problems.push(`the "exports" map in ${label} is out of date`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Generated output is out of date:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}\n\nRun \`npm run generate\` and commit the result.`,
    );
  }

  console.log(`Generated output is up to date (${expectedFiles.length} modules).`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
