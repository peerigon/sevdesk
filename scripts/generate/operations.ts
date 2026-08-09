import { alsoPaginated, notPaginated } from "./overrides.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type SpecOperation = {
  operationId: string;
  method: HttpMethod;
  path: string;
  tag: string;
  summary?: string;
  description?: string;
  deprecated: boolean;
  paginated: boolean;
};

/** The slice of the OpenAPI document this generator reads. */
export type Spec = {
  paths: Record<string, Record<string, unknown>>;
};

type RawOperation = {
  operationId?: string;
  tags?: Array<string>;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  parameters?: Array<{ in?: string }>;
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
};

const httpMethods = new Set(["get", "post", "put", "delete"]);

const hasPathParams = (operation: RawOperation) =>
  (operation.parameters ?? []).some((parameter) => parameter.in === "path");

/** Whether the 2xx response is an `{objects: [...]}` envelope around an array. */
const returnsObjectsArray = (operation: RawOperation) => {
  const successResponse = Object.entries(operation.responses ?? {}).find(([status]) =>
    status.startsWith("2"),
  )?.[1];
  const schema = successResponse?.content?.["application/json"]?.schema as
    | { properties?: { objects?: { type?: string } } }
    | undefined;

  return schema?.properties?.objects?.type === "array";
};

/**
 * Whether an operation returns a paginated list.
 *
 * The spec cannot answer this: sevDesk documents `limit`/`offset`/`countAll` in the API description
 * rather than on the operations (they appear on 3, 3 and 6 of 154 operations respectively). So we
 * infer it — a collection endpoint is a `GET` that addresses no single resource and returns an
 * `{objects: [...]}` array — and correct the handful of exceptions in `overrides.ts`.
 *
 * The path-param check is what separates `GET /Contact` (a list) from `GET /Contact/{contactId}`
 * (one contact, also wrapped in `objects`).
 */
export const isPaginated = (operation: RawOperation, method: string): boolean => {
  const { operationId = "" } = operation;

  if (notPaginated.has(operationId)) {
    return false;
  }

  if (alsoPaginated.has(operationId)) {
    return true;
  }

  return method === "get" && !hasPathParams(operation) && returnsObjectsArray(operation);
};

/** Reads every operation out of the spec, in spec order. */
export const readOperations = (spec: Spec): Array<SpecOperation> => {
  const operations: Array<SpecOperation> = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method)) {
        continue;
      }

      const operation = rawOperation as RawOperation;
      const { operationId, tags } = operation;

      if (operationId === undefined) {
        throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
      }

      const [tag] = tags ?? [];

      if (tag === undefined) {
        throw new Error(`${operationId} has no tag, so it has no module to live in`);
      }

      operations.push({
        operationId,
        method: method.toUpperCase() as HttpMethod,
        path,
        tag,
        summary: operation.summary,
        description: operation.description,
        deprecated: operation.deprecated === true,
        paginated: isPaginated(operation, method),
      });
    }
  }

  const duplicates = operations
    .map(({ operationId }) => operationId)
    .filter((id, index, all) => all.indexOf(id) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate operationIds in the spec: ${duplicates.join(", ")}`);
  }

  return operations;
};
