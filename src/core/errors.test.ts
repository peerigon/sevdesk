import { errors } from "@peerigon/typescript-toolkit/errors";
import { assert, describe, expect, expectTypeOf, it } from "vitest";

import {
  BadRequest,
  Conflict,
  Forbidden,
  httpErrorForStatus,
  NetworkError,
  NotFound,
  RateLimited,
  ServerError,
  SevDeskError,
  SevDeskHttpError,
  Unauthorized,
  UnexpectedStatus,
} from "./errors.ts";

const responseContext = {
  operationId: "getContacts",
  method: "GET",
  url: "https://my.sevdesk.de/api/v1/Contact",
  httpStatus: 400,
};

describe("SevDeskError", () => {
  it("namespaces error codes", () => {
    expect(new BadRequest(responseContext).code).toBe("SevDesk.Http.BadRequest");
    expect(new NetworkError({ ...responseContext, cause: "ECONNRESET" }).code).toBe(
      "SevDesk.NetworkError",
    );
  });

  it("makes HTTP errors instanceof both the sub-domain and the root domain", () => {
    const error = new NotFound({ ...responseContext, httpStatus: 404 });

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toBeInstanceOf(SevDeskHttpError);
    expect(error).toBeInstanceOf(SevDeskError);
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps transport errors out of the HTTP sub-domain", () => {
    const error = new NetworkError({ ...responseContext, cause: "ECONNRESET" });

    expect(error).toBeInstanceOf(SevDeskError);
    expect(error).not.toBeInstanceOf(SevDeskHttpError);
  });

  it("defaults httpStatus per error but lets the response override it", () => {
    expect(new ServerError(responseContext).context).toMatchObject({ httpStatus: 400 });
    expect(new ServerError({ ...responseContext, httpStatus: 503 }).context).toMatchObject({
      httpStatus: 503,
    });
  });

  it("prefers sevDesk's own message over the generic one", () => {
    expect(
      new BadRequest({ ...responseContext, sevDeskError: { message: "Invalid parameter" } })
        .message,
    ).toBe("Invalid parameter (GET https://my.sevdesk.de/api/v1/Contact)");
  });

  it("survives a JSON round-trip with its class identity", () => {
    const error = new Unauthorized({ ...responseContext, httpStatus: 401 });
    const restored = errors.parse(JSON.stringify(error));

    expect(restored).toBeInstanceOf(Unauthorized);
    expect(restored).toBeInstanceOf(SevDeskError);
    expect(restored.message).toBe(error.message);
    expect(restored.context).toMatchObject({ operationId: "getContacts", httpStatus: 401 });
  });
});

describe("catching errors", () => {
  it("narrows to a typed context on the HTTP sub-domain", () => {
    const thrown: unknown = new NotFound({ ...responseContext, httpStatus: 404 });

    assert(thrown instanceof SevDeskHttpError);

    // The whole point of the domain types: `context` survives the narrowing.
    expectTypeOf(thrown.context).toExtend<{ httpStatus: number; operationId: string }>();
    expect(thrown.context.httpStatus).toBe(404);
  });

  it("narrows to the request context on the root domain", () => {
    const thrown: unknown = new NetworkError({ ...responseContext, cause: "ECONNRESET" });

    assert(thrown instanceof SevDeskError);

    expectTypeOf(thrown.context).toExtend<{ operationId: string; method: string }>();
    expect(thrown.context.operationId).toBe("getContacts");
  });
});

describe("httpErrorForStatus", () => {
  it.for([
    [400, BadRequest],
    [401, Unauthorized],
    [403, Forbidden],
    [404, NotFound],
    [409, Conflict],
    [429, RateLimited],
    [500, ServerError],
    [502, ServerError],
    [599, ServerError],
  ] as const)("maps %i", ([status, ErrorClass]) => {
    expect(httpErrorForStatus(status)).toBe(ErrorClass);
  });

  it("falls back to UnexpectedStatus for unmapped statuses", () => {
    expect(httpErrorForStatus(418)).toBe(UnexpectedStatus);
    expect(httpErrorForStatus(302)).toBe(UnexpectedStatus);
  });
});
