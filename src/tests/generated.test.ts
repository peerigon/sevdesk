import { describe, expect, expectTypeOf, it } from "vitest";

import type { components } from "../generated/api.ts";
import { createContact, getContactById, getContacts } from "../generated/contact.ts";
import { getInvoices } from "../generated/invoice.ts";
import { createTestClient, objectsPage } from "./mock-client.ts";

/**
 * Exercises the generated modules as a consumer would, so that a change to the generator or the
 * core runtime that breaks the emitted surface fails here rather than in someone's application.
 */
describe("generated operation modules", () => {
  it("performs a real request against the right URL", async () => {
    const { client, calls } = createTestClient([{ body: objectsPage(2) }]);

    const { objects } = await getContacts(client, { query: { depth: "1", limit: 2 } });

    expect(calls[0]?.url).toBe("https://my.sevdesk.de/api/v1/Contact?depth=1&limit=2");
    expect(objects).toHaveLength(2);
  });

  it("substitutes path params", async () => {
    const { client, calls } = createTestClient([{ body: objectsPage(1) }]);

    await getContactById(client, { path: { contactId: 4711 } });

    expect(calls[0]?.url).toBe("https://my.sevdesk.de/api/v1/Contact/4711");
  });

  it("walks pages on a collection endpoint", async () => {
    const { client, calls } = createTestClient([
      { body: objectsPage(2, 0) },
      { body: objectsPage(2, 2) },
      { body: objectsPage(1, 4) },
    ]);

    const contacts = [];

    for await (const page of getContacts.pages(client, { query: { limit: 2 } })) {
      contacts.push(...(page.objects ?? []));
    }

    expect(contacts).toHaveLength(5);
    expect(calls).toHaveLength(3);
  });

  describe("types", () => {
    it("types responses from the spec's models", () => {
      expectTypeOf(getContacts).returns.resolves.toExtend<{
        objects?: Array<components["schemas"]["Model_ContactResponse"]>;
      }>();
    });

    it("adds total to collection responses, which the spec omits", () => {
      // sevDesk returns `total` when countAll is set, but documents it in the API
      // description rather than in any response schema.
      expectTypeOf(getContacts).returns.resolves.toExtend<{ total?: string }>();
    });

    it("does not add total to non-collection endpoints", () => {
      expectTypeOf(getContactById).returns.resolves.not.toHaveProperty("total");
    });

    it("types the request body", () => {
      expectTypeOf(createContact)
        .parameter(1)
        .toExtend<{ body: components["schemas"]["Model_Contact"] }>();
    });

    it("checks declared query params but still accepts undeclared ones", () => {
      // `depth` is declared with an enum, so a wrong value must not compile.
      expectTypeOf<{ depth: "1" }>().toExtend<
        NonNullable<Parameters<typeof getContacts>[1]>["query"]
      >();
      expectTypeOf<{ depth: "2" }>().not.toExtend<
        NonNullable<Parameters<typeof getContacts>[1]>["query"]
      >();
      // Undeclared filter params are how most of the sevDesk API is actually used.
      expectTypeOf<{ "contact.category[id]": number }>().toExtend<
        NonNullable<Parameters<typeof getContacts>[1]>["query"]
      >();
    });

    it("exposes pages() on collections but not on single-resource endpoints", () => {
      expectTypeOf(getInvoices).toHaveProperty("pages");
      expectTypeOf(getContacts).toHaveProperty("pages");
      expectTypeOf(getContactById).not.toHaveProperty("pages");
    });
  });
});
