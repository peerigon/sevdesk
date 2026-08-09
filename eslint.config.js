import typescriptPreset from "@peerigon/configs/eslint/presets/typescript";
import vitestRules from "@peerigon/configs/eslint/rules/vitest";
import stylesNoDefaultExport from "@peerigon/configs/eslint/styles/no-default-export";

export default [
  ...typescriptPreset,
  ...vitestRules,
  ...stylesNoDefaultExport,
  {
    // `api.ts` is openapi-typescript's output: ~18k lines of types shaped by
    // sevDesk's spec, not by us. Restyling it is not possible (it is
    // regenerated) and not useful (`tsc` already checks it). The tag modules in
    // the same directory are emitted by our own generator and stay linted.
    ignores: ["src/generated/api.ts"],
  },
];
