import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { toDocText } from "./emit.ts";
import { isPaginated, readOperations, type Spec } from "./operations.ts";
import { notPaginated } from "./overrides.ts";
import { specPath } from "./paths.ts";

const spec = parse(readFileSync(specPath, "utf8")) as Spec;
const operations = readOperations(spec);
const byId = new Map(operations.map((operation) => [operation.operationId, operation]));

const listResponse = {
  responses: {
    "200": {
      content: { "application/json": { schema: { properties: { objects: { type: "array" } } } } },
    },
  },
};

describe("isPaginated", () => {
  it("flags a GET collection endpoint", () => {
    expect(isPaginated({ operationId: "getThings", ...listResponse }, "get")).toBe(true);
  });

  it("does not flag a GET for a single resource, even though it returns an objects array", () => {
    expect(
      isPaginated(
        { operationId: "getThingById", parameters: [{ in: "path" }], ...listResponse },
        "get",
      ),
    ).toBe(false);
  });

  it("does not flag non-GET methods", () => {
    expect(isPaginated({ operationId: "createThing", ...listResponse }, "post")).toBe(false);
  });

  it("does not flag a GET returning a bare object", () => {
    expect(
      isPaginated(
        {
          operationId: "getThing",
          responses: {
            "200": { content: { "application/json": { schema: { properties: {} } } } },
          },
        },
        "get",
      ),
    ).toBe(false);
  });

  it("honours the notPaginated override", () => {
    expect(isPaginated({ operationId: "getProgress", ...listResponse }, "get")).toBe(false);
  });
});

describe("readOperations", () => {
  it("reads every operation in the spec", () => {
    expect(operations).toHaveLength(154);
  });

  it("gives every operation a tag to live in", () => {
    expect(operations.filter(({ tag }) => tag === "")).toHaveLength(0);
  });

  it("classifies the well-known collection endpoints as paginated", () => {
    for (const operationId of ["getContacts", "getInvoices", "getVouchers", "getOrders"]) {
      expect(byId.get(operationId)).toMatchObject({ paginated: true });
    }
  });

  it("classifies single-resource endpoints as not paginated", () => {
    for (const operationId of ["getContactById", "getInvoiceById", "getVoucherById"]) {
      expect(byId.get(operationId)).toMatchObject({ paginated: false });
    }
  });

  it("applies every notPaginated override to an operation that exists", () => {
    // Guards against the override list rotting when sevDesk renames an endpoint.
    for (const operationId of notPaginated) {
      expect(byId.get(operationId)).toMatchObject({ paginated: false });
    }
  });

  it("throws when an operation has no operationId", () => {
    expect(() =>
      readOperations({ paths: { "/Thing": { get: { tags: ["Thing"] } } } }),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: GET /Thing has no operationId]`);
  });

  it("throws when an operation has no tag", () => {
    expect(() =>
      readOperations({ paths: { "/Thing": { get: { operationId: "getThing" } } } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: getThing has no tag, so it has no module to live in]`,
    );
  });
});

describe("toDocText", () => {
  it("flattens the HTML sevDesk puts in descriptions", () => {
    expect(toDocText("Creates a new contact.<br>\r\n     For adding <b>addresses</b>.")).toBe(
      "Creates a new contact. For adding addresses.",
    );
  });

  it("neutralizes a comment terminator so it cannot break out of the JSDoc block", () => {
    expect(toDocText("ends the comment */ here")).not.toContain("*/");
  });
});
