/** The production sevDesk API. */
export const defaultBaseUrl = "https://my.sevdesk.de/api/v1";

export type ClientConfig = {
  /**
   * Your sevDesk API token — a 32 character hexadecimal string, found under _User → Settings → API_
   * in the sevDesk web app.
   */
  apiToken: string;
  /** Defaults to {@link defaultBaseUrl}. A trailing slash is fine. */
  baseUrl?: string;
  /**
   * Drop-in replacement for the global `fetch`, for tests, proxies or instrumentation. Defaults to
   * `globalThis.fetch`.
   */
  fetch?: typeof globalThis.fetch;
  /** Extra headers sent with every request. `Authorization` cannot be overridden. */
  headers?: Record<string, string>;
};

export type Client = {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
  readonly headers: Readonly<Record<string, string>>;
};

/**
 * Creates the client that every operation takes as its first argument.
 *
 * The client holds configuration only — it has no methods, so importing it never pulls in any of
 * the operation modules.
 *
 * ```ts
 * import { createClient } from "@peerigon/sevdesk";
 * import { getContacts } from "@peerigon/sevdesk/contact";
 *
 * const client = createClient({ apiToken: process.env.SEVDESK_API_TOKEN });
 * const { objects } = await getContacts(client, { query: { limit: 50 } });
 * ```
 */
export const createClient = ({
  apiToken,
  baseUrl = defaultBaseUrl,
  fetch = globalThis.fetch,
  headers = {},
}: ClientConfig): Client => {
  if (!apiToken) {
    throw new TypeError("createClient() requires an apiToken");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/u, ""),
    fetch,
    headers: {
      ...headers,
      // Set last so it can't be overridden by `headers`.
      Authorization: apiToken,
      Accept: "application/json",
    },
  };
};
