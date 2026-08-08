import { resolve } from "node:path";

const repoRoot = resolve(import.meta.filename, "../../..");

export const specPath = resolve(repoRoot, "openapi/openapi.yaml");
export const generatedDir = resolve(repoRoot, "src/generated");
export const packageJsonPath = resolve(repoRoot, "package.json");
export const jsonPath = resolve(repoRoot, "jsr.json");

/** Where the spec is fetched from by `npm run spec:update`. */
export const specUrl = "https://api.sevdesk.de/openapi.yaml";
