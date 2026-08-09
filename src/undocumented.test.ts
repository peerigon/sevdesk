import { describe, expect, expectTypeOf, it } from "vitest";

import { NotFound } from "./core/errors.ts";
import { createTestClient } from "./tests/mock-client.ts";
import {
  getPaymentMethods,
  getSevUsers,
  getStaticCountries,
  type PaymentMethod,
  type StaticCountry,
} from "./undocumented.ts";

const collection = (objectName: string, count: number) => ({
  objects: Array.from({ length: count }, (_unused, index) => ({
    id: String(index),
    objectName,
  })),
});

describe("undocumented operations", () => {
  it.for([
    ["getSevUsers", getSevUsers, "/SevUser"],
    ["getPaymentMethods", getPaymentMethods, "/PaymentMethod"],
    ["getStaticCountries", getStaticCountries, "/StaticCountry"],
  ] as const)("%s requests the right path", async ([operationId, operation, path]) => {
    const { client, calls } = createTestClient([{ body: collection("Whatever", 1) }]);

    await operation(client);

    expect(calls[0]?.url).toBe(`https://my.sevdesk.de/api/v1${path}`);
    expect(calls[0]?.method).toBe("GET");
    expect(operation.operationId).toBe(operationId);
  });

  it("passes query params through", async () => {
    const { client, calls } = createTestClient([{ body: collection("StaticCountry", 1) }]);

    await getStaticCountries(client, { query: { limit: 250, embed: ["translation"] } });

    expect(new URL(calls[0]?.url ?? "").search).toBe("?embed=translation&limit=250");
  });

  it("returns the parsed envelope", async () => {
    const { client } = createTestClient([{ body: collection("PaymentMethod", 2) }]);

    await expect(getPaymentMethods(client)).resolves.toMatchObject({
      objects: [{ id: "0" }, { id: "1" }],
    });
  });

  it("walks pages like a generated collection does", async () => {
    const { client, calls } = createTestClient([
      { body: collection("SevUser", 2) },
      { body: collection("SevUser", 1) },
    ]);
    const pages = [];

    for await (const page of getSevUsers.pages(client, { query: { limit: 2 } })) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    expect(calls.map((call) => new URL(call.url).search)).toStrictEqual([
      "?limit=2&offset=0",
      "?limit=2&offset=2",
    ]);
  });

  it("maps errors the same way generated operations do", async () => {
    const { client } = createTestClient([{ status: 404, body: {} }]);

    await expect(getSevUsers(client)).rejects.toBeInstanceOf(NotFound);
  });

  it("exposes raw() for non-JSON responses", async () => {
    const { client } = createTestClient([{ body: "id;name", contentType: "text/csv" }]);

    await expect(getSevUsers.raw(client).then((response) => response.text())).resolves.toBe(
      "id;name",
    );
  });

  describe("types", () => {
    it("types the response from the hand-written model", () => {
      expectTypeOf(getStaticCountries).returns.resolves.toExtend<{
        objects?: Array<StaticCountry>;
      }>();
      expectTypeOf(getPaymentMethods).returns.resolves.toExtend<{
        objects?: Array<PaymentMethod>;
      }>();
    });

    it("carries total, since these are collections", () => {
      expectTypeOf(getSevUsers).returns.resolves.toExtend<{ total?: string }>();
    });

    it("accepts pagination and arbitrary query params", () => {
      expectTypeOf<{ limit: number; offset: number; countAll: boolean }>().toExtend<
        NonNullable<Parameters<typeof getSevUsers>[1]>["query"]
      >();
      expectTypeOf<{ "anything[else]": string }>().toExtend<
        NonNullable<Parameters<typeof getSevUsers>[1]>["query"]
      >();
    });

    it("keeps model fields open, since no spec pins them down", () => {
      // These shapes are hand-written from what the API returns, so an unexpected field must not
      // be a type error for consumers.
      expectTypeOf<{
        objectName: "StaticCountry";
        somethingNew: string;
      }>().toExtend<StaticCountry>();
    });
  });
});
