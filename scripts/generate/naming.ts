/**
 * Turns names from the OpenAPI spec into names in our public API.
 *
 * **These functions define the public API.** Changing one renames exported functions or module
 * subpaths, which is a breaking change for consumers — see AGENTS.md. The spec's own casing is
 * inconsistent (`getContacts` next to `UpdateCommunicationWay` and `getcreditNotePositions`), so
 * the rules below normalize rather than pass through.
 */

const splitWords = (value: string) =>
  value
    // Split camelCase and PascalCase boundaries, keeping acronyms together:
    // "getPdf" -> ["get", "Pdf"], "exportDatevCSV" -> ["export", "Datev", "CSV"]
    .replaceAll(/([a-z\d])([A-Z])/gu, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .split(/[\s_./-]+/u)
    .filter((word) => word !== "");

/**
 * Tag → module file name and subpath, in kebab-case.
 *
 * `"CheckAccountTransaction"` → `"check-account-transaction"`, importable as
 * `@peerigon/sevdesk/check-account-transaction`.
 */
export const moduleName = (tag: string): string =>
  splitWords(tag)
    .map((word) => word.toLowerCase())
    .join("-");

/**
 * `operationId` → exported function name, in camelCase.
 *
 * `"UpdateCommunicationWay"` → `"updateCommunicationWay"`, `"getcreditNotePositions"` →
 * `"getcreditNotePositions"` (already camelCase — only the first character is ever lowered, because
 * re-splitting a word the spec glued together would be guesswork).
 */
export const exportName = (operationId: string): string =>
  operationId.charAt(0).toLowerCase() + operationId.slice(1);
