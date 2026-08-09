import { describe, expect, it } from "vitest";

import { createClient, defaultBaseUrl } from "./client.ts";

const apiToken = "0123456789abcdef0123456789abcdef";

describe("createClient", () => {
  it("defaults to the production API", () => {
    expect(createClient({ apiToken }).baseUrl).toBe(defaultBaseUrl);
  });

  it("sends the API token as the Authorization header", () => {
    expect(createClient({ apiToken }).headers).toMatchObject({
      Authorization: apiToken,
      Accept: "application/json",
    });
  });

  it("merges custom headers", () => {
    const client = createClient({ apiToken, headers: { "X-Trace-Id": "abc" } });

    expect(client.headers).toMatchObject({ "X-Trace-Id": "abc", Authorization: apiToken });
  });

  it("does not let custom headers override the Authorization header", () => {
    const client = createClient({ apiToken, headers: { Authorization: "leaked" } });

    expect(client.headers["Authorization"]).toBe(apiToken);
  });

  it("strips trailing slashes from the base URL", () => {
    expect(createClient({ apiToken, baseUrl: "https://sevdesk.test/api/v1//" }).baseUrl).toBe(
      "https://sevdesk.test/api/v1",
    );
  });

  it("throws when the API token is empty", () => {
    expect(() => createClient({ apiToken: "" })).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: createClient() requires an apiToken]`,
    );
  });
});
