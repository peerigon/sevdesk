# @peerigon/sevdesk

💵 **Unofficial TypeScript SDK for [sevDesk](https://sevdesk.de)** — generated from sevDesk's own OpenAPI spec, so every one of the 154 endpoints is typed, not just the popular ones.

- **Fully typed** requests and responses, including query params — while still accepting the many filter params sevDesk documents only in prose
- **Modular**: import two endpoints, ship two endpoints
- **Typed errors** grouped into a catchable domain
- **Pagination** you can drive yourself, or walk with an async generator

## Installation

```sh
npm install @peerigon/sevdesk
```

Requires Node.js 20+ or any runtime with a global `fetch`.

## Usage

```ts
import { createClient } from "@peerigon/sevdesk";
import { getContacts } from "@peerigon/sevdesk/contact";

const apiToken = process.env.SEVDESK_API_TOKEN;

if (!apiToken) throw new Error("SEVDESK_API_TOKEN is not set");

const client = createClient({ apiToken });

const { objects } = await getContacts(client, { query: { limit: 50 } });

for (const contact of objects ?? []) {
  console.log(contact.name);
}
```

Operations are standalone functions taking the client as their first argument. Nothing is bundled that you didn't import — `@peerigon/sevdesk/contact` pulls in the contact endpoints and the shared runtime, and nothing else.

Find your API token in the sevDesk web app under **User → Settings → API**.

### Query parameters

Params the spec declares are checked; anything else is passed through, because most of sevDesk's filtering is documented in prose rather than in the spec.

```ts
await getContacts(client, {
  query: {
    depth: "1", // declared: only "0" | "1" compiles
    limit: 100,
    embed: ["category", "parent"], // arrays are comma-joined
    "contact.category[id]": 3, // undeclared, still allowed
  },
});
```

### Pagination

`limit`, `offset` and `countAll` are accepted on every collection endpoint:

```ts
const page = await getContacts(client, {
  query: { limit: 50, offset: 100, countAll: true },
});

page.total; // present when countAll is true
```

To walk everything, use `.pages()` — an async generator that yields one response per page:

```ts
for await (const page of getContacts.pages(client, { query: { limit: 200 } })) {
  for (const contact of page.objects ?? []) {
    console.log(contact.name);
  }
}
```

It stops on the first short page. `.pages()` exists only on endpoints that return collections, so reaching for it on a single-resource endpoint is a type error rather than an infinite loop.

### Errors

Errors are defined with [`@peerigon/typescript-toolkit/errors`](https://github.com/peerigon/typescript-toolkit/blob/main/src/errors/README.md): namespaced, serializable, and catchable by domain.

```ts
import { NotFound, SevDeskError, SevDeskHttpError, Unauthorized } from "@peerigon/sevdesk";

try {
  await getContactById(client, { path: { contactId: 4711 } });
} catch (error) {
  if (error instanceof NotFound) {
    // one specific error
  } else if (error instanceof SevDeskHttpError) {
    // any status error — 4xx or 5xx
    console.error(error.context.httpStatus, error.context.sevDeskError?.message);
  } else if (error instanceof SevDeskError) {
    // anything this SDK throws, including NetworkError
  }
}
```

| Error              | When                                                     |
| ------------------ | -------------------------------------------------------- |
| `BadRequest`       | 400                                                      |
| `Unauthorized`     | 401 — check your API token                               |
| `Forbidden`        | 403                                                      |
| `NotFound`         | 404                                                      |
| `Conflict`         | 409                                                      |
| `RateLimited`      | 429                                                      |
| `ServerError`      | 5xx                                                      |
| `UnexpectedStatus` | any other non-2xx status                                 |
| `NetworkError`     | the request never completed (DNS, reset, timeout, abort) |
| `InvalidResponse`  | a 2xx response whose body wasn't JSON                    |

Every error carries `context` with `operationId`, `method`, `url` and — for status errors — `httpStatus` plus sevDesk's own error payload. Errors survive `JSON.stringify` and can be restored with `errors.parse()` without losing their class.

### Non-JSON endpoints

The `Export/*` endpoints return CSV or ZIP even though the spec declares them as JSON. Use `.raw()` to get the `Response`:

```ts
import { exportInvoice } from "@peerigon/sevdesk/export";

// GET /Export/invoiceCsv — returns CSV, not JSON
const response = await exportInvoice.raw(client);
const csv = await response.text();
```

`.raw()` still throws on a non-2xx status.

### Types

Every model from the spec is available:

```ts
import type { components } from "@peerigon/sevdesk/types";

type Contact = components["schemas"]["Model_ContactResponse"];
```

## Modules

One module per sevDesk API tag:

`accounting-contact` · `basics` · `check-account` · `check-account-transaction` · `communication-way` · `contact` · `contact-address` · `contact-field` · `credit-note` · `credit-note-pos` · `export` · `invoice` · `invoice-pos` · `layout` · `order` · `order-pos` · `part` · `private-transaction-rule` · `report` · `tag` · `voucher` · `voucher-pos`

## Undocumented endpoints

sevDesk serves a few collection endpoints they don't describe in their OpenAPI spec, so they can't
be generated. The ones v2 relied on are hand-written in a separate module:

```ts
import { getPaymentMethods, getSevUsers, getStaticCountries } from "@peerigon/sevdesk/undocumented";

const { objects } = await getStaticCountries(client, { query: { limit: 250 } });
```

They behave like any other operation — typed responses, `.pages()`, `.raw()`, the same errors — but
their paths and response shapes are our best knowledge rather than sevDesk's contract, so they can
break without warning. The smoke suite covers them for exactly that reason.

For anything else sevDesk serves undocumented, declare it yourself:

```ts
import { defineUndocumentedCollection } from "@peerigon/sevdesk";

const getThings = defineUndocumentedCollection<{ id?: string }>("getThings", "/Thing");
```

## Migrating from v2

v3 is a rewrite. The `SevDeskClient` class is gone, along with its hand-picked subset of endpoints — everything sevDesk documents is now available.

| v2                              | v3                                                    |
| ------------------------------- | ----------------------------------------------------- |
| `new SevDeskClient({ apiKey })` | `createClient({ apiToken })`                          |
| `client.getInvoices(params)`    | `getInvoices(client, { query: params })`              |
| `client.getInvoice({ id })`     | `getInvoiceById(client, { path: { invoiceId: id } })` |
| `SevDeskUrls`                   | removed                                               |
| `UnknownApiError`               | `SevDeskError` and its subclasses                     |
| `client.getPaymentMethods()`    | `getPaymentMethods(client)` — `/undocumented`         |
| `client.getSevUsers()`          | `getSevUsers(client)` — `/undocumented`               |
| `client.getStaticCountries()`   | `getStaticCountries(client)` — `/undocumented`        |
| manual `limit`/`offset` loops   | `.pages()`                                            |

Responses keep sevDesk's `{ objects: [...] }` envelope, as in v2.

## Contributing

The endpoint modules are generated. See [AGENTS.md](./AGENTS.md) for how to update the spec, change the generator, and what counts as a breaking change.

```sh
npm install
npm run generate   # rebuild src/generated/ from openapi/openapi.yaml
npm test
```

`npm test` never touches the network. There is also a small read-only smoke suite that runs against
the live API with `npm run smoke`; it needs a `SEVDESK_API_TOKEN`, which Peerigon developers get by
mounting the shared 1Password Environment as `.env` (see [AGENTS.md](./AGENTS.md#the-sevdesk-api-token)).
Otherwise, copy `.env.example` to `.env` and fill in your own token.

## License

[MIT](./LICENSE)
