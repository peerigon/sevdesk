/**
 * Endpoints sevDesk serves but does not describe in their OpenAPI spec.
 *
 * Everything in `src/generated/` is derived from the spec and is as correct as the spec is. These
 * are not: the paths and the response shapes are hand-written, carried over from
 * `@peerigon/sevdesk@2`, which called them for years. Treat them as a bridge — if sevDesk ever
 * documents one, it moves to a generated module and the export here is deprecated.
 *
 * They are collection endpoints that back the pickers in the sevDesk UI (payment methods, users,
 * countries), which is why v2 needed them: you need a `PaymentMethod` id to create an invoice, and
 * a `StaticCountry` id to write an address.
 *
 * ```ts
 * import { createClient } from "@peerigon/sevdesk";
 * import { getStaticCountries } from "@peerigon/sevdesk/undocumented";
 *
 * const { objects } = await getStaticCountries(client, { query: { limit: 250 } });
 * ```
 *
 * @module
 */
import {
  defineUndocumentedCollection,
  type UndocumentedCollection,
  type UndocumentedPaginatedOperation,
} from "./core/operation.ts";

export type { UndocumentedCollection } from "./core/operation.ts";

/** The `{ id, objectName }` reference sevDesk uses for nested resources. */
export type ObjectReference<Name extends string> = {
  id?: string;
  objectName?: Name;
};

/**
 * A sevDesk user.
 *
 * SevDesk returns almost nothing here unless the token's user may see it — the `hidden` flag is
 * their marker for that — so every field is optional.
 */
export type SevUser = ObjectReference<"SevUser"> & {
  create?: string;
  update?: string;
  fullname?: string;
  /** `"1"` when the record is withheld from the requesting user. */
  hidden?: string;
  [key: string]: unknown;
};

/** A payment method, as referenced by `Invoice.paymentMethod`. */
export type PaymentMethod = ObjectReference<"PaymentMethod"> & {
  create?: string;
  update?: string;
  name?: string;
  text?: string;
  [key: string]: unknown;
};

/** A country, as referenced by `Invoice.addressCountry` and `ContactAddress.country`. */
export type StaticCountry = ObjectReference<"StaticCountry"> & {
  code?: string;
  name?: string;
  nameEn?: string;
  translationCode?: string;
  locale?: string;
  priority?: string;
  [key: string]: unknown;
};

/**
 * Retrieve the users of the sevDesk account.
 *
 * `GET /SevUser`
 *
 * Paginated — use `.pages()` to walk every page.
 *
 * Not in sevDesk's OpenAPI spec; the response type is hand-written.
 */
export const getSevUsers: UndocumentedPaginatedOperation<UndocumentedCollection<SevUser>> =
  defineUndocumentedCollection<SevUser>("getSevUsers", "/SevUser");

/**
 * Retrieve the payment methods of the sevDesk account.
 *
 * `GET /PaymentMethod`
 *
 * Paginated — use `.pages()` to walk every page.
 *
 * Not in sevDesk's OpenAPI spec; the response type is hand-written.
 */
export const getPaymentMethods: UndocumentedPaginatedOperation<
  UndocumentedCollection<PaymentMethod>
> = defineUndocumentedCollection<PaymentMethod>("getPaymentMethods", "/PaymentMethod");

/**
 * Retrieve the countries sevDesk knows.
 *
 * `GET /StaticCountry`
 *
 * Paginated — use `.pages()` to walk every page. There are a few hundred, so pass a `limit` above
 * the default page size if you want them in one request.
 *
 * Not in sevDesk's OpenAPI spec; the response type is hand-written.
 */
export const getStaticCountries: UndocumentedPaginatedOperation<
  UndocumentedCollection<StaticCountry>
> = defineUndocumentedCollection<StaticCountry>("getStaticCountries", "/StaticCountry");
