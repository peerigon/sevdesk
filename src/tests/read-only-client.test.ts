import { describe, expect, it } from "vitest";

import { createReadOnlyClient } from "./read-only-client.ts";

describe("createReadOnlyClient", () => {
  it("blocks non-GET methods", async () => {
    const client = createReadOnlyClient("0123456789abcdef0123456789abcdef");

    await expect(
      client.fetch("https://my.sevdesk.de/api/v1/Contact", { method: "POST" }),
    ).rejects.toThrow(/must stay read-only/u);
  });

  it("blocks lowercase methods", async () => {
    const client = createReadOnlyClient("0123456789abcdef0123456789abcdef");

    await expect(
      client.fetch("https://my.sevdesk.de/api/v1/Contact", { method: "post" }),
    ).rejects.toThrow(/Blocked a POST/u);
  });

  it("blocks mutating GET endpoints", async () => {
    const client = createReadOnlyClient("0123456789abcdef0123456789abcdef");

    await expect(
      client.fetch("https://my.sevdesk.de/api/v1/CreditNote/1/sendByWithRender?sendType=PRN"),
    ).rejects.toThrow(/mutating GET/u);
    await expect(
      client.fetch("https://my.sevdesk.de/api/v1/Export/createDatevCsvZipExportJob"),
    ).rejects.toThrow(/mutating GET/u);
  });

  it("blocks Request objects that carry a non-GET method", async () => {
    const client = createReadOnlyClient("0123456789abcdef0123456789abcdef");

    await expect(
      client.fetch(new Request("https://my.sevdesk.de/api/v1/Contact", { method: "DELETE" })),
    ).rejects.toThrow(/Blocked a DELETE/u);
  });
});
