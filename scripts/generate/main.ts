import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import { emitExports, emitModule, groupByModule } from "./emit.ts";
import { readOperations, type Spec, type SpecOperation } from "./operations.ts";
import { generatedDir, jsonPath, packageJsonPath, specPath } from "./paths.ts";

export const readSpec = (): Spec => parse(readFileSync(specPath, "utf8")) as Spec;

/** The module files the spec implies, keyed by file name. */
export const buildModuleFiles = (
  spec: Spec,
): {
  operations: Array<SpecOperation>;
  moduleNames: Array<string>;
  files: Map<string, string>;
} => {
  const operations = readOperations(spec);
  const modules = groupByModule(operations);
  const files = new Map<string, string>();

  for (const [name, moduleOperations] of modules) {
    const [first] = moduleOperations;

    if (first !== undefined) {
      files.set(`${name}.ts`, emitModule(first.tag, moduleOperations));
    }
  }

  return { operations, moduleNames: [...modules.keys()], files };
};

/**
 * Regenerates `src/generated/` and the `exports` maps of package.json and jsr.json from the
 * committed spec.
 *
 * `api.ts` is produced separately by `openapi-typescript` (the `generate:types` script) and is
 * deliberately left in place here.
 */
export const generate = (targetDir = generatedDir): ReturnType<typeof buildModuleFiles> => {
  const { operations, moduleNames, files } = buildModuleFiles(readSpec());

  mkdirSync(targetDir, { recursive: true });

  for (const file of readdirSync(targetDir)) {
    if (file !== "api.ts") {
      rmSync(join(targetDir, file), { recursive: true });
    }
  }

  for (const [name, contents] of files) {
    writeFileSync(join(targetDir, name), contents);
  }

  if (targetDir === generatedDir) {
    for (const [path, jsr] of [
      [packageJsonPath, false],
      [jsonPath, true],
    ] as const) {
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

      manifest["exports"] = emitExports(moduleNames, { jsr });
      writeFileSync(path, `${JSON.stringify(manifest, undefined, 2)}\n`);
    }
  }

  return { operations, moduleNames, files };
};

if (process.argv[1] === import.meta.filename) {
  const { operations, moduleNames } = generate();
  const paginated = operations.filter(({ paginated: isPaginated }) => isPaginated).length;

  console.log(
    `Generated ${moduleNames.length} modules with ${operations.length} operations ` +
      `(${paginated} paginated).`,
  );
}
