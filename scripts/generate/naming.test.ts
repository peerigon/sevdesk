import { describe, expect, it } from "vitest";

import { exportName, moduleName } from "./naming.ts";

describe("moduleName", () => {
  it.for([
    ["Contact", "contact"],
    ["CheckAccountTransaction", "check-account-transaction"],
    ["PrivateTransactionRule", "private-transaction-rule"],
    ["CreditNotePos", "credit-note-pos"],
    ["InvoicePos", "invoice-pos"],
    ["sevdesk", "sevdesk"],
  ] as const)("maps the %s tag to %s", ([tag, expected]) => {
    expect(moduleName(tag)).toBe(expected);
  });

  it("keeps acronyms together", () => {
    expect(moduleName("ExportCSVJob")).toBe("export-csv-job");
  });

  it("is stable — changing it renames public subpaths", () => {
    expect(moduleName(moduleName("CheckAccountTransaction"))).toBe("check-account-transaction");
  });
});

describe("exportName", () => {
  it("leaves already-camelCase operationIds alone", () => {
    expect(exportName("getContacts")).toBe("getContacts");
  });

  it.for([
    // The spec is inconsistent about the leading character; these are the
    // real-world cases it has to handle.
    ["UpdateCommunicationWay", "updateCommunicationWay"],
    ["SaveVoucher", "saveVoucher"],
  ] as const)("lowers the leading capital of %s", ([operationId, expected]) => {
    expect(exportName(operationId)).toBe(expected);
  });

  it("does not try to re-split words the spec glued together", () => {
    // "getcreditNotePositions" stays as-is: guessing a split here would be a
    // breaking rename the next time the guess changed.
    expect(exportName("getcreditNotePositions")).toBe("getcreditNotePositions");
    expect(exportName("updateContactfield")).toBe("updateContactfield");
  });
});
