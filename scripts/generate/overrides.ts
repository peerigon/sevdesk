/**
 * Hand-maintained corrections to what the generator infers from the spec.
 *
 * The spec doesn't say which endpoints paginate — `limit`/`offset`/`countAll` are documented in
 * prose only — so `isPaginated()` infers it (see `operations.ts`). This file is where that
 * inference gets corrected. Prefer fixing the rule when a whole class of endpoints is wrong, and
 * listing an operation here only when it is genuinely a one-off.
 */

/**
 * Operations the rule flags as paginated but which return a fixed-size result. Giving them a
 * `pages()` that loops forever over the same response would be worse than useless.
 */
export const notPaginated = new Set([
  // /Progress and /ExportJob: a single status object wrapped in `objects`.
  "generateDownloadHash",
  "getProgress",
  "jobDownloadInfo",
  // /Textparser: a fixed dictionary lookup, not a collection.
  "getPlaceholder",
  // /ReceiptGuidance: static bookkeeping guidance for the given input.
  "forAllAccounts",
  "forAccountNumber",
  "forTaxRule",
  "forRevenue",
  "forExpense",
]);

/** Operations that do paginate but which the rule misses. */
export const alsoPaginated = new Set<string>();
