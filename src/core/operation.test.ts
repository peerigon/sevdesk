import { describe, expect, expectTypeOf, it } from "vitest";

import { createFailingClient, createTestClient, objectsPage } from "../tests/mock-client.ts";
import {
  BadRequest,
  Conflict,
  Forbidden,
  InvalidResponse,
  NetworkError,
  NotFound,
  RateLimited,
  ServerError,
  SevDeskError,
  SevDeskHttpError,
  Unauthorized,
  UnexpectedStatus,
} from "./errors.ts";
import { buildPath, buildSearchParams, defineOperation } from "./operation.ts";

const getContacts = defineOperation("getContacts", {
  method: "GET",
  path: "/Contact",
  paginated: true,
});
const getContactById = defineOperation("getContactById", {
  method: "GET",
  path: "/Contact/{contactId}",
});
const createContact = defineOperation("createContact", {
  method: "POST",
  path: "/Contact",
});

describe("buildSearchParams", () => {
  it("serializes primitives", () => {
    expect(buildSearchParams({ limit: 50, countAll: true, depth: "1" }).toString()).toBe(
      "countAll=true&depth=1&limit=50",
    );
  });

  it("comma-joins arrays, as sevDesk expects for embed", () => {
    expect(buildSearchParams({ embed: ["category", "parent"] }).toString()).toBe(
      "embed=category%2Cparent",
    );
  });

  it("drops undefined values", () => {
    expect(buildSearchParams({ limit: undefined, offset: 0 }).toString()).toBe("offset=0");
  });

  it("keeps falsy values that are not undefined", () => {
    expect(buildSearchParams({ countAll: false, offset: 0, name: "" }).toString()).toBe(
      "countAll=false&name=&offset=0",
    );
  });

  it("returns an empty string for no params", () => {
    expect(buildSearchParams().toString()).toBe("");
  });
});

describe("buildPath", () => {
  it("substitutes path params", () => {
    expect(buildPath("/Contact/{contactId}", { contactId: 42 })).toBe("/Contact/42");
  });

  it("encodes path params", () => {
    expect(buildPath("/Tag/{name}", { name: "a/b c" })).toBe("/Tag/a%2Fb%20c");
  });

  it("leaves paths without params untouched", () => {
    expect(buildPath("/Contact")).toBe("/Contact");
  });

  it("throws when a path param is missing", () => {
    expect(() => buildPath("/Contact/{contactId}", {})).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Missing path parameter "contactId" for "/Contact/{contactId}"]`,
    );
  });
});

describe("defineOperation", () => {
  describe("requests", () => {
    it("builds the URL from base URL, path and query", async () => {
      const { client, calls } = createTestClient([{ body: objectsPage(1) }]);

      await getContactById(client, {
        path: { contactId: 42 },
        query: { embed: ["category", "parent"] },
      });

      expect(calls[0]).toMatchObject({
        url: "https://my.sevdesk.de/api/v1/Contact/42?embed=category%2Cparent",
        method: "GET",
      });
    });

    it("sends undeclared query params, which the spec omits but the API accepts", async () => {
      const { client, calls } = createTestClient();

      await getContacts(client, { query: { "contact.category[id]": 3, unknownFilter: "x" } });

      expect(calls[0]?.url).toBe(
        "https://my.sevdesk.de/api/v1/Contact?contact.category%5Bid%5D=3&unknownFilter=x",
      );
    });

    it("sends a JSON body and the matching Content-Type", async () => {
      const { client, calls } = createTestClient([{ status: 201, body: { id: "1" } }]);

      const body = {
        name: "ACME GmbH",
        status: 1000,
        category: { id: 3, objectName: "Category" },
      };

      await createContact(client, { body });

      expect(calls[0]).toMatchObject({
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("omits the body for requests without one", async () => {
      const { client, calls } = createTestClient();

      await getContacts(client);

      expect(calls[0]?.body).toBeUndefined();
      expect(calls[0]?.headers).not.toHaveProperty("Content-Type");
    });

    it("returns the parsed response body", async () => {
      const { client } = createTestClient([{ body: objectsPage(2) }]);

      await expect(getContacts(client)).resolves.toMatchObject({
        objects: [{ id: "0" }, { id: "1" }],
      });
    });

    it("exposes the operationId", () => {
      expect(getContacts.operationId).toBe("getContacts");
    });
  });

  describe("error handling", () => {
    it.for([
      [400, BadRequest],
      [401, Unauthorized],
      [403, Forbidden],
      [404, NotFound],
      [409, Conflict],
      [429, RateLimited],
      [500, ServerError],
      [503, ServerError],
      [418, UnexpectedStatus],
    ] as const)("maps status %i to the matching error", async ([status, ErrorClass]) => {
      const { client } = createTestClient([{ status, body: {} }]);

      await expect(getContacts(client)).rejects.toBeInstanceOf(ErrorClass);
    });

    it("makes every status error catchable as SevDeskHttpError and SevDeskError", async () => {
      const { client } = createTestClient([{ status: 401, body: {} }]);

      await expect(getContacts(client)).rejects.toBeInstanceOf(SevDeskHttpError);
      await expect(getContacts(client)).rejects.toBeInstanceOf(SevDeskError);
    });

    it("carries request context and sevDesk's own error payload", async () => {
      const { client } = createTestClient([
        {
          status: 400,
          body: { error: { message: "Unknown parameter", code: 151, exceptionUUID: "u-1" } },
        },
      ]);

      await expect(getContacts(client)).rejects.toMatchObject({
        code: "SevDesk.Http.BadRequest",
        message: "Unknown parameter (GET https://my.sevdesk.de/api/v1/Contact)",
        context: {
          operationId: "getContacts",
          method: "GET",
          httpStatus: 400,
          sevDeskError: { message: "Unknown parameter", code: 151, exceptionUUID: "u-1" },
        },
      });
    });

    it("falls back to a generic message when the body carries no error payload", async () => {
      const { client } = createTestClient([{ status: 404, body: "<html>nope</html>" }]);

      await expect(getContacts(client)).rejects.toMatchObject({
        message: "Not found (GET https://my.sevdesk.de/api/v1/Contact)",
        context: { responseBody: "<html>nope</html>" },
      });
    });

    it("throws NetworkError when the request never completes", async () => {
      const { client } = createFailingClient(new Error("ECONNRESET"));

      await expect(getContacts(client)).rejects.toMatchObject({
        code: "SevDesk.NetworkError",
        message: "Request failed: ECONNRESET (GET https://my.sevdesk.de/api/v1/Contact)",
      });
      await expect(getContacts(client)).rejects.toBeInstanceOf(NetworkError);
    });

    it("throws InvalidResponse for a 2xx body that is not JSON", async () => {
      const { client } = createTestClient([{ body: "id;name\n1;ACME", contentType: "text/csv" }]);

      await expect(getContacts(client)).rejects.toBeInstanceOf(InvalidResponse);
    });

    it("throws InvalidResponse for a malformed JSON body", async () => {
      const { client } = createTestClient([{ body: "{not json" }]);

      await expect(getContacts(client)).rejects.toBeInstanceOf(InvalidResponse);
    });

    it("returns undefined for an empty body", async () => {
      const { client } = createTestClient([{ body: "" }]);

      await expect(getContacts(client)).resolves.toBeUndefined();
    });
  });

  describe("raw", () => {
    it("returns the Response without parsing it", async () => {
      const { client } = createTestClient([{ body: "id;name\n1;ACME", contentType: "text/csv" }]);
      const response = await getContacts.raw(client);

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("id;name\n1;ACME");
    });

    it("still throws on a non-2xx status", async () => {
      const { client } = createTestClient([{ status: 401, body: {} }]);

      await expect(getContacts.raw(client)).rejects.toBeInstanceOf(Unauthorized);
    });
  });

  describe("types", () => {
    it("requires path params only when the endpoint has them", () => {
      expectTypeOf(getContacts).parameter(1).toExtend<undefined | object>();
      expectTypeOf(getContactById).parameter(1).toExtend<{ path: { contactId: number } }>();
    });

    it("types the response from the spec", () => {
      expectTypeOf(getContacts).returns.resolves.toExtend<{
        objects?: Array<unknown> | undefined;
      }>();
    });

    it("exposes pages() only on paginated operations", () => {
      expectTypeOf(getContacts).toHaveProperty("pages");
      expectTypeOf(getContactById).not.toHaveProperty("pages");
    });
  });
});
