import { writeFileSync } from "node:fs";

import { specPath, specUrl } from "./generate/paths.ts";

/**
 * Refreshes the committed spec snapshot.
 *
 * The snapshot is committed on purpose: sevDesk changes the spec without notice, and a committed
 * copy turns that into a reviewable diff instead of a regeneration that silently changes the SDK.
 */
const response = await fetch(specUrl);

if (!response.ok) {
  throw new Error(`Could not fetch ${specUrl}: ${response.status} ${response.statusText}`);
}

writeFileSync(specPath, await response.text());

console.log(`Updated ${specPath}. Run \`npm run generate\` next, then review the diff.`);
