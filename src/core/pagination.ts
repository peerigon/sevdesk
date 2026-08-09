import type { QueryValue } from "./operation.ts";

/**
 * Page size used when walking pages without an explicit `limit`.
 *
 * SevDesk allows 1–1000 and defaults to 100 when the param is omitted. We send it explicitly so the
 * "was this page short?" check below is reliable.
 */
export const defaultPageSize = 100;

type Page = { objects?: Array<unknown> };

/**
 * Walks a paginated endpoint by increasing `offset`, yielding one response per page.
 *
 * Termination: sevDesk gives no "has more" flag and `total` is only present with `countAll=true`,
 * so the generator stops as soon as a page comes back with fewer records than the page size. A
 * collection whose length is an exact multiple of the page size therefore costs one extra, empty
 * request — that is the price of not relying on an optional field.
 *
 * @param fetchPage Runs one request with the given query params.
 * @param query Base query params. `limit` sets the page size; `offset` sets where the walk starts.
 */
// eslint-disable-next-line func-style -- a generator cannot be an arrow function.
export async function* paginate<PageType extends Page>(
  fetchPage: (query: Record<string, QueryValue>) => Promise<PageType>,
  query: Record<string, QueryValue> = {},
): AsyncGenerator<PageType, void, undefined> {
  // Non-positive limits would never satisfy `received < limit` and loop forever.
  const limit =
    typeof query["limit"] === "number" && query["limit"] > 0 ? query["limit"] : defaultPageSize;
  let offset = typeof query["offset"] === "number" ? query["offset"] : 0;

  while (true) {
    // Sequential by nature: each page's offset depends on the previous page's size.
    // eslint-disable-next-line no-await-in-loop
    const page = await fetchPage({ ...query, limit, offset });

    yield page;

    const received = page.objects?.length ?? 0;

    if (received < limit) {
      return;
    }

    offset += received;
  }
}
