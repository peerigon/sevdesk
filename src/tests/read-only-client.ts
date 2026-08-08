import { type Client, createClient } from "../core/client.ts";

/**
 * A client that physically cannot mutate anything.
 *
 * The smoke tests run against a **production** sevDesk account, so "these tests only read" must be
 * a mechanism rather than a convention: the wrapped `fetch` refuses any method other than GET
 * before the request leaves the process. A future test that reaches for `createContact` fails
 * loudly instead of writing to real books.
 */
export const createReadOnlyClient = (apiToken: string): Client => {
  const client = createClient({
    apiToken,
    fetch: (input, init) => {
      const method = init?.method ?? "GET";

      if (method !== "GET") {
        throw new Error(
          `Blocked a ${method} request: the smoke tests run against a production account and ` +
            `must stay read-only.`,
        );
      }

      return globalThis.fetch(input, init);
    },
  });

  return client;
};
