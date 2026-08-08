import { describe, expect, it, vi } from "vitest";

import { createTestClient, objectsPage } from "../tests/mock-client.ts";
import { defineOperation } from "./operation.ts";
import { defaultPageSize, paginate } from "./pagination.ts";

const getContacts = defineOperation("getContacts", {
  method: "GET",
  path: "/Contact",
  paginated: true,
});

const collect = async <PageType>(pages: AsyncGenerator<PageType, void, undefined>) => {
  const collected: Array<PageType> = [];

  for await (const page of pages) {
    collected.push(page);
  }

  return collected;
};

describe("paginate", () => {
  it("stops on the first short page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(objectsPage(2))
      .mockResolvedValueOnce(objectsPage(1));

    const pages = await collect(paginate(fetchPage, { limit: 2 }));

    expect(pages).toHaveLength(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { limit: 2, offset: 0 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { limit: 2, offset: 2 });
  });

  it("yields a single empty page when there are no records", async () => {
    const fetchPage = vi.fn().mockResolvedValue(objectsPage(0));

    await expect(collect(paginate(fetchPage, { limit: 2 }))).resolves.toHaveLength(1);
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("makes one extra request when the total is an exact multiple of the page size", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(objectsPage(2))
      .mockResolvedValueOnce(objectsPage(2))
      .mockResolvedValueOnce(objectsPage(0));

    await expect(collect(paginate(fetchPage, { limit: 2 }))).resolves.toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("defaults to the default page size", async () => {
    const fetchPage = vi.fn().mockResolvedValue(objectsPage(0));

    await collect(paginate(fetchPage));

    expect(fetchPage).toHaveBeenCalledWith({ limit: defaultPageSize, offset: 0 });
  });

  it("ignores non-positive limits so pagination cannot loop forever", async () => {
    const fetchPage = vi.fn().mockResolvedValue(objectsPage(0));

    await collect(paginate(fetchPage, { limit: 0 }));

    expect(fetchPage).toHaveBeenCalledWith({ limit: defaultPageSize, offset: 0 });
  });

  it("starts at the given offset", async () => {
    const fetchPage = vi.fn().mockResolvedValue(objectsPage(0));

    await collect(paginate(fetchPage, { limit: 10, offset: 30 }));

    expect(fetchPage).toHaveBeenCalledWith({ limit: 10, offset: 30 });
  });

  it("keeps the other query params on every page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(objectsPage(1))
      .mockResolvedValueOnce(objectsPage(0));

    await collect(paginate(fetchPage, { limit: 1, depth: "1" }));

    expect(fetchPage).toHaveBeenNthCalledWith(2, { limit: 1, offset: 1, depth: "1" });
  });

  it("stops early when the consumer breaks out of the loop", async () => {
    const fetchPage = vi.fn().mockResolvedValue(objectsPage(2));

    for await (const page of paginate(fetchPage, { limit: 2 })) {
      expect(page.objects).toHaveLength(2);
      break;
    }

    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("treats a missing objects array as the end", async () => {
    const fetchPage = vi.fn().mockResolvedValue({});

    await expect(collect(paginate(fetchPage, { limit: 2 }))).resolves.toHaveLength(1);
  });
});

describe("operation.pages", () => {
  it("walks every page against the API", async () => {
    const { client, calls } = createTestClient([
      { body: objectsPage(2, 0) },
      { body: objectsPage(1, 2) },
    ]);

    const pages = await collect(getContacts.pages(client, { query: { limit: 2 } }));

    expect(pages.flatMap((page) => page.objects ?? [])).toHaveLength(3);
    expect(calls.map((call) => new URL(call.url).search)).toStrictEqual([
      "?limit=2&offset=0",
      "?limit=2&offset=2",
    ]);
  });

  it("keeps undeclared filter params across pages", async () => {
    const { client, calls } = createTestClient([{ body: objectsPage(0) }]);

    await collect(getContacts.pages(client, { query: { depth: "1", limit: 10 } }));

    expect(new URL(calls[0]?.url ?? "").search).toBe("?depth=1&limit=10&offset=0");
  });
});
