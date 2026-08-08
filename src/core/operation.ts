import type { operations } from "../generated/api.ts";
import type { Client } from "./client.ts";
import {
  httpErrorForStatus,
  InvalidResponse,
  NetworkError,
  type SevDeskErrorPayload,
} from "./errors.ts";
import { paginate } from "./pagination.ts";

/** Every `operationId` in the sevDesk OpenAPI spec. */
export type OperationId = keyof operations;

/**
 * A value that can be serialized into a query string.
 *
 * Nested objects become bracket keys (`sevQuery[modelName]=Invoice`), matching how sevDesk
 * documents nested query params. Arrays stay comma-joined.
 */
export type QueryValue =
  | string
  | number
  | boolean
  | Array<string | number>
  | { readonly [key: string]: QueryValue }
  | undefined;

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type IsNever<T> = [T] extends [never] ? true : false;

type DeclaredQuery<Id extends OperationId> = NonNullable<operations[Id]["parameters"]["query"]>;

/**
 * The query params the spec declares for this operation, plus anything else.
 *
 * The spec documents only a fraction of the params sevDesk accepts — the filtering params live in
 * prose, and `limit`/`offset`/`countAll` are declared on almost no operation — so unknown keys stay
 * allowed. Declared params are still fully checked.
 */
export type QueryOf<Id extends OperationId> = (IsNever<DeclaredQuery<Id>> extends true
  ? object
  : DeclaredQuery<Id>) &
  Record<string, QueryValue>;

export type PathOf<Id extends OperationId> = operations[Id]["parameters"] extends {
  path: infer Path;
}
  ? [Path] extends [undefined]
    ? never
    : Path
  : never;

type DeclaredBody<Id extends OperationId> = NonNullable<operations[Id]["requestBody"]>;

export type BodyOf<Id extends OperationId> =
  IsNever<DeclaredBody<Id>> extends true
    ? never
    : DeclaredBody<Id> extends { content: { "application/json": infer Body } }
      ? Body
      : // Spec uses the non-standard `form-data` media type for uploads (e.g. voucherUploadFile).
        // Consumers pass a `FormData` instance; fetch sets the multipart boundary itself.
        DeclaredBody<Id> extends { content: { "form-data": unknown } }
        ? FormData
        : never;

/** The body of the operation's success response (2xx), as declared by the spec. */
export type ResponseOf<Id extends OperationId, Responses = operations[Id]["responses"]> =
  | 200
  | 201 extends infer Status
  ? Status extends keyof Responses
    ? Responses[Status] extends { content: { "application/json": infer Json } }
      ? Json
      : never
    : never
  : never;

/** Pagination params, accepted by every operation that returns a list. */
export type PaginationParams = {
  /** Page size, between 1 and 1000. */
  limit?: number;
  /** How many records to skip. */
  offset?: number;
  /** Ask sevDesk to include the total record count in the response. */
  countAll?: boolean;
};

/**
 * Arguments for an operation. `path` is required exactly when the endpoint has path params, `body`
 * exactly when it takes a request body, and `query` is always optional.
 */
export type Args<Id extends OperationId, ExtraQuery = object> = (IsNever<PathOf<Id>> extends true
  ? { path?: never }
  : { path: PathOf<Id> }) &
  (IsNever<BodyOf<Id>> extends true ? { body?: never } : { body: BodyOf<Id> }) & {
    query?: QueryOf<Id> & ExtraQuery;
    /** Aborts the request. */
    signal?: AbortSignal;
  };

/** An operation with no `Args` beyond the optional ones. */
type HasOnlyOptionalArgs<Id extends OperationId> =
  IsNever<PathOf<Id>> extends true ? (IsNever<BodyOf<Id>> extends true ? true : false) : false;

type Invoke<Id extends OperationId, Result, ExtraQuery = object> =
  HasOnlyOptionalArgs<Id> extends true
    ? (client: Client, args?: Args<Id, ExtraQuery>) => Result
    : (client: Client, args: Args<Id, ExtraQuery>) => Result;

/**
 * The response of a collection endpoint.
 *
 * `total` is added on top of the spec: sevDesk returns it whenever `countAll: true` is sent, but
 * documents it in the API description rather than in the response schemas, so it is missing from
 * every generated model.
 */
export type PaginatedResponseOf<Id extends OperationId> = ResponseOf<Id> & {
  /** Total number of available records. Only present when `countAll: true` was sent. */
  total?: string;
};

export type Operation<Id extends OperationId, Result = ResponseOf<Id>> = Invoke<
  Id,
  Promise<Result>
> & {
  /** The `operationId` from the OpenAPI spec. */
  readonly operationId: Id;
  /**
   * Performs the request but returns the raw `Response` instead of parsed JSON. Non-2xx responses
   * still throw. Use this for endpoints that return something other than JSON — the `Export/*`
   * endpoints return CSV and ZIP, even though the spec declares them as `application/json`.
   */
  readonly raw: Invoke<Id, Promise<Response>>;
};

export type PaginatedOperation<Id extends OperationId> = Operation<Id, PaginatedResponseOf<Id>> & {
  /**
   * Walks every page, yielding one response per page. Stops on the first short page.
   *
   * ```ts
   * for await (const page of getContacts.pages(client)) {
   *   for (const contact of page.objects ?? []) console.log(contact.name);
   * }
   * ```
   */
  readonly pages: Invoke<
    Id,
    AsyncGenerator<PaginatedResponseOf<Id>, void, undefined>,
    PaginationParams
  >;
};

export type OperationConfig = {
  method: HttpMethod;
  /** The spec path, with `{placeholders}`, e.g. `"/Contact/{contactId}"`. */
  path: string;
  /** Whether this operation returns a paginated list. */
  paginated?: boolean;
};

const appendQueryValue = (searchParams: URLSearchParams, key: string, value: QueryValue): void => {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    // sevDesk expects comma-separated lists, e.g. `embed=category,parent`.
    searchParams.append(key, value.join(","));
    return;
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendQueryValue(searchParams, `${key}[${nestedKey}]`, nestedValue);
    }

    return;
  }

  searchParams.append(key, String(value));
};

/** Serializes query params, dropping `undefined`, flattening objects, and comma-joining arrays. */
export const buildSearchParams = (query: Record<string, QueryValue> = {}): URLSearchParams => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(searchParams, key, value);
  }

  searchParams.sort();

  return searchParams;
};

/** Substitutes `{placeholders}` in a spec path with the given path params. */
export const buildPath = (
  path: string,
  pathParams: Record<string, string | number | boolean> = {},
): string =>
  path.replaceAll(/\{(?<name>[^}]+)\}/gu, (_match, name: string) => {
    const value = pathParams[name];

    if (value === undefined) {
      throw new TypeError(`Missing path parameter "${name}" for "${path}"`);
    }

    return encodeURIComponent(String(value));
  });

const jsonContentType = /^application\/(?:[\w.+-]+\+)?json\b/iu;

const parseErrorPayload = (body: string): SevDeskErrorPayload | undefined => {
  try {
    const parsed: unknown = JSON.parse(body);

    if (typeof parsed === "object" && parsed !== null) {
      const { error } = parsed as { error?: unknown };

      if (typeof error === "object" && error !== null) {
        return error;
      }
    }
  } catch {
    // Not JSON — the raw body is reported via `responseBody` instead.
  }

  return undefined;
};

type RequestArgs = {
  path?: Record<string, string | number | boolean>;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Runs one request: builds the URL, sends it, and turns any non-2xx status into the matching
 * {@link SevDeskHttpError}.
 */
const send = async (
  client: Client,
  operationId: string,
  config: OperationConfig,
  args: RequestArgs,
) => {
  const url = new URL(client.baseUrl + buildPath(config.path, args.path));

  url.search = buildSearchParams(args.query).toString();

  const hasBody = args.body !== undefined;
  const requestUrl = url.toString();
  const context = { operationId, method: config.method, url: requestUrl };

  const isFormData = typeof FormData !== "undefined" && args.body instanceof FormData;
  let response: Response;

  try {
    response = await client.fetch(requestUrl, {
      method: config.method,
      signal: args.signal,
      // FormData must not get a Content-Type — fetch adds the multipart boundary.
      headers:
        hasBody && !isFormData
          ? { ...client.headers, "Content-Type": "application/json" }
          : client.headers,
      body: hasBody
        ? isFormData
          ? (args.body as FormData)
          : JSON.stringify(args.body)
        : undefined,
    });
  } catch (error) {
    throw new NetworkError({
      ...context,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    const SevDeskHttpErrorClass = httpErrorForStatus(response.status);

    throw new SevDeskHttpErrorClass({
      ...context,
      httpStatus: response.status,
      sevDeskError: parseErrorPayload(responseBody),
      responseBody,
    });
  }

  return { response, context };
};

/**
 * Builds the function that represents one sevDesk operation.
 *
 * Everything in `src/generated/` is a call to this. Keeping the whole runtime here is what makes
 * each generated module a handful of lines per endpoint.
 */
export const defineOperation = <const Id extends OperationId, const Config extends OperationConfig>(
  operationId: Id,
  config: Config,
): Config extends { paginated: true } ? PaginatedOperation<Id> : Operation<Id> => {
  const raw = async (client: Client, args: RequestArgs = {}): Promise<Response> => {
    const { response } = await send(client, operationId, config, args);

    return response;
  };

  const invoke = async (client: Client, args: RequestArgs = {}) => {
    const { response, context } = await send(client, operationId, config, args);
    const body = await response.text();

    // Every operation in the spec declares `application/json` for its 2xx response, so an empty
    // body is a response we cannot honour the return type with. Returning `undefined` here would
    // make the signature lie; `.raw()` is the way to handle a body we can't parse.
    if (body === "" || !jsonContentType.test(response.headers.get("content-type") ?? "")) {
      throw new InvalidResponse({
        ...context,
        httpStatus: response.status,
        responseBody: body,
      });
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new InvalidResponse({
        ...context,
        httpStatus: response.status,
        responseBody: body,
      });
    }
  };

  const operation = Object.assign(invoke, {
    operationId,
    raw,
    ...(config.paginated === true && {
      pages: (client: Client, args: RequestArgs = {}) =>
        paginate(
          async (query) =>
            invoke(client, { ...args, query }) as Promise<{ objects?: Array<unknown> }>,
          args.query,
        ),
    }),
  });

  return operation as never;
};

export { defaultPageSize } from "./pagination.ts";
