import { type Client, createClient } from "../core/client.ts";

/** Derived from `fetch` itself, since `RequestInfo` is not in this project's lib. */
type FetchInput = Parameters<typeof globalThis.fetch>[0];

const toUrl = (input: FetchInput): string => {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
};

const toMethod = (input: FetchInput, init?: RequestInit): string => {
  const fromRequest = typeof input === "object" && "method" in input ? input.method : undefined;
  const method = init?.method ?? fromRequest ?? "GET";

  return method.toUpperCase();
};

/**
 * GET endpoints in the sevDesk API that still mutate state (send documents, start export jobs,
 * enshrine records via query flags). Blocking only non-GET is not enough for production smoke.
 */
const isMutatingGet = (url: string): boolean =>
  url.includes("/Export/") ||
  /\/sendBy(?:WithRender)?(?:\?|$)/u.test(url) ||
  /[?&]enshrine(?:Documents)?=/iu.test(url);

/**
 * A client that physically cannot mutate anything.
 *
 * The smoke tests run against a **production** sevDesk account, so "these tests only read" must be
 * a mechanism rather than a convention: the wrapped `fetch` refuses any method other than GET, and
 * also refuses the GET endpoints that sevDesk uses for side effects, before the request leaves the
 * process. A future test that reaches for `createContact` or `sendCreditNoteByPrinting` fails
 * loudly instead of writing to real books.
 */
export const createReadOnlyClient = (apiToken: string): Client => {
  const client = createClient({
    apiToken,
    fetch: (input, init) => {
      const method = toMethod(input, init);
      const url = toUrl(input);

      if (method !== "GET") {
        return Promise.reject(
          new Error(
            `Blocked a ${method} request: the smoke tests run against a production account and ` +
              `must stay read-only.`,
          ),
        );
      }

      if (isMutatingGet(url)) {
        return Promise.reject(
          new Error(
            `Blocked a mutating GET to ${url}: the smoke tests run against a production account ` +
              `and must stay read-only.`,
          ),
        );
      }

      return globalThis.fetch(input, init);
    },
  });

  return client;
};
