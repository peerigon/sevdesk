import { assert, beforeAll, describe, expect, it } from "vitest";

import { createClient } from "../core/client.ts";
import { SevDeskHttpError, Unauthorized } from "../core/errors.ts";
import { bookkeepingSystemVersion } from "../generated/basics.ts";
import { getCheckAccounts } from "../generated/check-account.ts";
import { getCommunicationWays } from "../generated/communication-way.ts";
import { getContactById, getContacts } from "../generated/contact.ts";
import { getInvoices } from "../generated/invoice.ts";
import { getParts } from "../generated/part.ts";
import { getTags } from "../generated/tag.ts";
import { getPaymentMethods, getSevUsers, getStaticCountries } from "../undocumented.ts";
import { createReadOnlyClient } from "./read-only-client.ts";

/**
 * Smoke tests against the **live sevDesk API**.
 *
 * Run with `npm run smoke` and a `SEVDESK_API_TOKEN` in `.env`. They are excluded from `npm test`
 * on purpose — `npm test` must never depend on a token or reach the network.
 *
 * These run against a production account, so two rules hold throughout:
 *
 * 1. **Read-only.** Every request goes through {@link createReadOnlyClient}, which blocks any non-GET
 *    method and the GET endpoints that still mutate (exports, send-by, enshrine flags) before the
 *    request is sent. No test may create, update or delete anything.
 * 2. **No assertions on private data.** Assertions cover structure only — `objectName`, types, array
 *    shapes, HTTP status. Never a customer name, an amount, or an ID's value. Nothing from a
 *    response body is logged.
 *
 * What they are for: proving that the parts we could not verify against mocks are right — auth, URL
 * and query construction, envelope shape, pagination, the `total` field we add on top of the spec,
 * and error mapping.
 */
const apiToken = process.env["SEVDESK_API_TOKEN"];

/** Asserts every entry is the resource we asked for — the only field safe to check on real data. */
const expectAllAre = (objects: Array<{ objectName?: string }> | undefined, objectName: string) => {
  for (const object of objects ?? []) {
    expect(object.objectName).toBe(objectName);
  }
};

describe.skipIf(apiToken === undefined || apiToken === "")("smoke: live sevDesk API", () => {
  let client: ReturnType<typeof createReadOnlyClient>;

  beforeAll(() => {
    client = createReadOnlyClient(apiToken!);
  });

  describe("connectivity", () => {
    it("authenticates and reaches the API", async () => {
      const response = await bookkeepingSystemVersion(client);

      expect(response).toBeTypeOf("object");
    });

    it("blocks any attempt to mutate, so these tests cannot write to production", async () => {
      // Guards the guard: if this ever stops throwing, the read-only promise is void.
      await expect(
        client.fetch("https://my.sevdesk.de/api/v1/Contact", { method: "POST" }),
      ).rejects.toThrow(/must stay read-only/u);
    });
  });

  describe("collection endpoints", () => {
    it.for([
      ["contacts", getContacts, "Contact"],
      ["invoices", getInvoices, "Invoice"],
      ["parts", getParts, "Part"],
      ["tags", getTags, "Tag"],
      ["check accounts", getCheckAccounts, "CheckAccount"],
      ["communication ways", getCommunicationWays, "CommunicationWay"],
    ] as const)("returns well-formed %s", async ([, operation, objectName]) => {
      const { objects } = await operation(client, { query: { limit: 10 } });

      // Not asserted as non-empty: an account may legitimately have none of a given resource, and
      // the point here is that the envelope and the resource type are right.
      expect(objects).toBeInstanceOf(Array);
      expectAllAre(objects, objectName);
    });
  });

  describe("undocumented endpoints", () => {
    // These are the only endpoints in the SDK with nothing behind them but our word: they are
    // absent from sevDesk's OpenAPI spec, so the paths and response shapes in src/undocumented.ts
    // are hand-written. A generated module failing here would mean sevDesk changed something; one
    // of these failing means we got it wrong, or sevDesk retired the endpoint. That makes these
    // the smoke tests most worth having.
    it.for([
      ["users", getSevUsers, "SevUser"],
      ["payment methods", getPaymentMethods, "PaymentMethod"],
      ["countries", getStaticCountries, "StaticCountry"],
    ] as const)("returns well-formed %s", async ([, operation, objectName]) => {
      const { objects } = await operation(client, { query: { limit: 10 } });

      expect(objects).toBeInstanceOf(Array);
      expectAllAre(objects, objectName);
    });

    it("returns countries, which every account has regardless of its data", async () => {
      // Unlike the account-scoped collections, this one is sevDesk's own static list, so it is
      // safe to require it to be non-empty — and that is what makes it a real check that the
      // undocumented path resolves rather than quietly returning nothing.
      const { objects } = await getStaticCountries(client, { query: { limit: 10 } });

      expect(objects?.length ?? 0).toBeGreaterThan(0);
    });

    it("supports pagination on an undocumented collection", async () => {
      const response = await getStaticCountries(client, {
        query: { limit: 1, countAll: true },
      });

      expect(response.objects).toHaveLength(1);
      // `total` is ours, not the spec's — worth confirming it survives on these endpoints too.
      expect(Number(response.total)).toBeGreaterThan(1);
    });
  });

  describe("path parameters", () => {
    it("fetches a single contact by the id from the list", async () => {
      const { objects } = await getContacts(client, { query: { limit: 1 } });
      const [firstContact] = objects ?? [];

      if (firstContact?.id === undefined) {
        // Nothing to look up on an empty account — the collection test already covered the shape.
        return;
      }

      const response = await getContactById(client, {
        path: { contactId: Number(firstContact.id) },
      });

      expect(response.objects).toHaveLength(1);
      expectAllAre(response.objects, "Contact");
    });
  });

  describe("query parameters", () => {
    it("honours limit", async () => {
      const { objects } = await getContacts(client, { query: { limit: 2 } });

      expect(objects?.length ?? 0).toBeLessThanOrEqual(2);
    });

    it("returns total when countAll is set", async () => {
      // `total` is not in the spec's response schema — we add it to collection responses because
      // sevDesk documents it in prose only. This is the check that it is really there.
      const response = await getContacts(client, { query: { limit: 1, countAll: true } });

      expect(response.total).toBeDefined();
      expect(Number(response.total)).not.toBeNaN();
    });

    it("accepts query params the spec does not declare", async () => {
      // `embed` is documented in sevDesk's API description but declared on almost no operation —
      // the reason QueryOf<> stays open.
      const { objects } = await getContacts(client, {
        query: { limit: 1, embed: ["category"] },
      });

      expect(objects).toBeInstanceOf(Array);
      expectAllAre(objects, "Contact");
    });
  });

  describe("pagination", () => {
    it("advances the offset across pages", async () => {
      const pages = [];

      for await (const page of getContacts.pages(client, { query: { limit: 1 } })) {
        pages.push(page);

        if (pages.length === 2) {
          break;
        }
      }

      if (pages.length < 2) {
        // Fewer than two contacts on this account; nothing to compare.
        return;
      }

      const ids = pages.map((page) => page.objects?.[0]?.id);

      expect(ids[0]).toBeDefined();
      // Distinct ids prove the offset advanced rather than refetching page one. The ids are
      // compared to each other, never asserted against a value or logged.
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("error mapping", () => {
    it("throws Unauthorized for a bad token", async () => {
      const badClient = createClient({ apiToken: "0".repeat(32) });

      await expect(getContacts(badClient)).rejects.toBeInstanceOf(Unauthorized);
    });

    it("throws a typed HTTP error for a contact that does not exist", async () => {
      const error = await getContactById(client, {
        path: { contactId: Number.MAX_SAFE_INTEGER },
      }).catch((error_: unknown) => error_);

      assert(error instanceof SevDeskHttpError);

      // sevDesk answers 400 here rather than 404 (its own spec calls this "Bad request. Contact
      // was not found"), so this asserts the class and a client-error status, not an exact code.
      expect(error.context.httpStatus).toBeGreaterThanOrEqual(400);
      expect(error.context.httpStatus).toBeLessThan(500);
      expect(error.context.operationId).toBe("getContactById");
    });
  });
});
