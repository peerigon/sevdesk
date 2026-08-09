import { type Client, createClient } from "../core/client.ts";

export type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | FormData | undefined;
};

export type MockResponse = {
  status?: number;
  /** Serialized as JSON unless it is already a string. */
  body?: unknown;
  contentType?: string;
};

const toResponse = ({
  status = 200,
  body = {},
  contentType = "application/json",
}: MockResponse): Response =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });

/** Derived from `fetch` itself, since `RequestInfo` is not in this project's lib. */
type FetchInput = Parameters<typeof globalThis.fetch>[0];

const toUrl = (input: FetchInput): string => {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
};

/**
 * A client whose `fetch` replays the given responses in order and records every call, so tests can
 * assert on the request without touching the network.
 *
 * The queue is not reused once dry — a full last page would otherwise make `.pages()` loop forever.
 * Pad the queue (or end with a short/empty page) when a test makes multiple requests.
 */
export const createTestClient = (
  responses: Array<MockResponse> = [{}],
  config: { apiToken?: string; baseUrl?: string } = {},
): { client: Client; calls: Array<FetchCall> } => {
  const calls: Array<FetchCall> = [];
  let index = 0;

  const client: Client = createClient({
    apiToken: "0123456789abcdef0123456789abcdef",
    ...config,
    fetch: (input, init) => {
      calls.push({
        url: toUrl(input),
        method: init?.method ?? "GET",
        headers: (init?.headers ?? {}) as Record<string, string>,
        body:
          typeof init?.body === "string" || init?.body instanceof FormData ? init.body : undefined,
      });

      const response = responses[index];

      if (response === undefined) {
        throw new Error(
          `createTestClient: no mock response left after ${String(responses.length)} call(s)`,
        );
      }

      index += 1;

      return Promise.resolve(toResponse(response));
    },
  });

  return { client, calls };
};

/** A client whose `fetch` always rejects, for exercising the network path. */
export const createFailingClient = (cause: Error): { client: Client } => {
  const client: Client = createClient({
    apiToken: "0123456789abcdef0123456789abcdef",
    fetch: () => Promise.reject(cause),
  });

  return { client };
};

/** Builds `n` list entries, so pagination tests read as intent not noise. */
export const objectsPage = (
  count: number,
  startId = 0,
): { objects: Array<{ id: string; objectName: string }> } => ({
  objects: Array.from({ length: count }, (_unused, index) => ({
    id: String(startId + index),
    objectName: "Contact",
  })),
});
