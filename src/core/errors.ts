import {
  type DefinedErrorInstance,
  type ErrorDomain,
  errors,
} from "@peerigon/typescript-toolkit/errors";

/**
 * The error payload sevDesk returns alongside a non-2xx status.
 *
 * Not part of the OpenAPI spec — the spec documents 400/401/500 with a description and no response
 * schema — so this is derived from what the API actually sends and every field is optional on
 * purpose.
 */
export type SevDeskErrorPayload = {
  message?: string;
  code?: number | string;
  exceptionUUID?: string;
};

/** Context every sevDesk error carries, whether or not a response arrived. */
export type RequestContext = {
  /** The `operationId` from the OpenAPI spec, e.g. `"getContacts"`. */
  operationId: string;
  method: string;
  /** Request URL, including query params. */
  url: string;
};

/** Context for errors raised after the server responded. */
export type ResponseContext = RequestContext & {
  httpStatus: number;
  /** SevDesk's own error payload, when the response carried a parseable one. */
  sevDeskError?: SevDeskErrorPayload;
  /** The raw response body, for diagnosing responses we couldn't interpret. */
  responseBody?: string;
};

/**
 * A domain, typed so that `instanceof` narrows to something useful.
 *
 * The toolkit types a domain's construct signature as `new () => Error`, which would make `error
 * instanceof SevDeskError` narrow away `context` — the one field you actually want in a catch
 * block. Restating the construct signature (rather than intersecting one on) keeps exactly one
 * signature, so narrowing is unambiguous.
 */
type SevDeskErrorDomain<ErrorContext> = (new (
  message?: string,
) => DefinedErrorInstance & { readonly context: ErrorContext }) &
  Pick<ErrorDomain<Record<string, never>>, "code" | "define" | "domain">;

/**
 * Domains are abstract — `new SevDeskError()` throws — so nothing is ever constructed through this
 * signature. It exists only to describe what `instanceof` yields, which the toolkit's own type
 * cannot express, hence the cast.
 */
const asDomain = <ErrorContext>(
  domain: ErrorDomain<Record<string, never>>,
): SevDeskErrorDomain<ErrorContext> => domain as SevDeskErrorDomain<ErrorContext>;

/**
 * Root domain for everything this SDK throws.
 *
 * `errors.domain()` claims the name globally and throws on a second claim, so this module must stay
 * the only place that declares it. (Two copies of this package in one dependency tree will
 * therefore fail at import time — that is the toolkit's intended behaviour, not something to work
 * around here.)
 */
export const SevDeskError: SevDeskErrorDomain<RequestContext> = asDomain(errors.domain("SevDesk"));

/**
 * Sub-domain for errors that map to an HTTP status. Catching this catches every status-derived
 * error at once:
 *
 * ```ts
 * catch (error) {
 *   if (error instanceof SevDeskHttpError) console.error(error.context.httpStatus);
 * }
 * ```
 */
export const SevDeskHttpError: SevDeskErrorDomain<ResponseContext> = asDomain(
  SevDeskError.domain("Http"),
);

const describe = (context: ResponseContext, fallback: string): string =>
  `${context.sevDeskError?.message ?? fallback} (${context.method} ${context.url})`;

const httpErrors = SevDeskHttpError.define({
  /** 400 — sevDesk rejected the request. Usually a malformed or invalid parameter. */
  BadRequest: {
    context: { httpStatus: 400 },
    message: (context: ResponseContext) => describe(context, "Bad request"),
  },
  /** 401 — the API token is missing, malformed, or not accepted. */
  Unauthorized: {
    context: { httpStatus: 401 },
    message: (context: ResponseContext) =>
      describe(context, "Authentication required — check your API token"),
  },
  /** 403 — the token is valid but lacks permission for this resource. */
  Forbidden: {
    context: { httpStatus: 403 },
    message: (context: ResponseContext) => describe(context, "Forbidden"),
  },
  /** 404 — no such endpoint or resource. */
  NotFound: {
    context: { httpStatus: 404 },
    message: (context: ResponseContext) => describe(context, "Not found"),
  },
  /** 409 — the resource is in a state that forbids this operation. */
  Conflict: {
    context: { httpStatus: 409 },
    message: (context: ResponseContext) => describe(context, "Conflict"),
  },
  /** 429 — rate limit exceeded. */
  RateLimited: {
    context: { httpStatus: 429 },
    message: (context: ResponseContext) => describe(context, "Rate limit exceeded"),
  },
  /** 5xx — sevDesk failed to handle the request. */
  ServerError: {
    context: { httpStatus: 500 },
    message: (context: ResponseContext) => describe(context, "sevDesk server error"),
  },
  /** Any other non-2xx status, so no response is ever silently swallowed. */
  UnexpectedStatus: {
    message: (context: ResponseContext) =>
      describe(context, `Unexpected status ${context.httpStatus}`),
  },
});

/**
 * The shape shared by every status error class.
 *
 * Written out rather than derived via `typeof`, because JSR requires an explicit type on everything
 * reachable from the public API — a `typeof httpErrors` reference would drag the private `define()`
 * result into it.
 */
export type SevDeskHttpErrorClass = new (
  context: ResponseContext,
) => DefinedErrorInstance & { readonly context: ResponseContext };

export const BadRequest: SevDeskHttpErrorClass = httpErrors.BadRequest;
export const Unauthorized: SevDeskHttpErrorClass = httpErrors.Unauthorized;
export const Forbidden: SevDeskHttpErrorClass = httpErrors.Forbidden;
export const NotFound: SevDeskHttpErrorClass = httpErrors.NotFound;
export const Conflict: SevDeskHttpErrorClass = httpErrors.Conflict;
export const RateLimited: SevDeskHttpErrorClass = httpErrors.RateLimited;
export const ServerError: SevDeskHttpErrorClass = httpErrors.ServerError;
export const UnexpectedStatus: SevDeskHttpErrorClass = httpErrors.UnexpectedStatus;

const transportErrors = SevDeskError.define({
  NetworkError: {
    message: (context: RequestContext & { cause: string }) =>
      `Request failed: ${context.cause} (${context.method} ${context.url})`,
  },
  InvalidResponse: {
    message: (context: ResponseContext) =>
      `Could not parse the response body as JSON (${context.method} ${context.url})`,
  },
});

/** The request never completed — DNS failure, connection reset, timeout, abort. */
export const NetworkError: new (
  context: RequestContext & { cause: string },
) => DefinedErrorInstance = transportErrors.NetworkError;

/** A 2xx response whose body wasn't the JSON this operation expects. */
export const InvalidResponse: SevDeskHttpErrorClass = transportErrors.InvalidResponse;

/** Maps an HTTP status onto the error class that represents it. */
export const httpErrorForStatus = (status: number): SevDeskHttpErrorClass => {
  switch (status) {
    case 400: {
      return BadRequest;
    }
    case 401: {
      return Unauthorized;
    }
    case 403: {
      return Forbidden;
    }
    case 404: {
      return NotFound;
    }
    case 409: {
      return Conflict;
    }
    case 429: {
      return RateLimited;
    }
    default: {
      return status >= 500 ? ServerError : UnexpectedStatus;
    }
  }
};
