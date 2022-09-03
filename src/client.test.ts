import "./tests/setup.js";
import * as fs from "fs";
import { test } from "uvu";
import * as assert from "uvu/assert";
import { SevDeskClient } from "./client.js";
import * as env from "./tests/env.js";
import {
  ModelCommunicationWay,
  ModelContact,
  ModelDocument,
  ModelDocumentFolder,
  ModelInvoice,
  ModelUnity,
} from "./interfaces.js";

let sevDeskClient: SevDeskClient;

test.before.each(() => {
  sevDeskClient = new SevDeskClient({
    apiKey: env.TEST_SEVDESK_API_TOKEN,
  });
});

test("Get invoices", async () => {
  const { objects: invoices } = await sevDeskClient.getInvoices();

  assert.is(invoices.length > 0, true);
  invoices.forEach(assertIsInvoice);

  const [firstInvoice] = invoices;

  const {
    objects: [invoice],
  } = await sevDeskClient.getInvoice({ id: firstInvoice.id });

  assertIsInvoice(invoice);
});

test("Get next invoice number", async () => {
  const { objects: nextInvoiceNumber } =
    await sevDeskClient.getNextInvoiceNumber({
      invoiceType: "RE",
      useNextNumber: false,
    });

  assert.type(nextInvoiceNumber, "string");
});

test("Get document folders", async () => {
  const { objects: documentFolders } = await sevDeskClient.getDocumentFolders();

  assert.is(documentFolders.length > 0, true);
  documentFolders.forEach(assertIsDocumentFolder);
});

test("Get documents", async () => {
  const { objects: documents } = await sevDeskClient.getDocuments();

  assert.is(documents.length > 0, true);
  documents.forEach(assertIsDocument);
});

// If you run this test, you need to remove the document manually afterwards
test.skip("Add document", async () => {
  const {
    objects: [document],
  } = await sevDeskClient.addDocument({
    file: fs.createReadStream("./package.json"),
  });

  assertIsDocument(document);
});

test("Get contacts", async () => {
  const { objects: contacts } = await sevDeskClient.getContacts();

  assert.is(contacts.length > 0, true);
  contacts.forEach(assertIsContact);
});

test("Get communication ways", async () => {
  const { objects: communicationWays } =
    await sevDeskClient.getCommunicationWays();

  assert.is(communicationWays.length > 0, true);
  communicationWays.forEach(assertIsCommunicationWay);
});

test("Get unities", async () => {
  const { objects: unities } = await sevDeskClient.getUnities();

  assert.is(unities.length > 0, true);
  unities.forEach(assertIsUnity);
});

const assertIsInvoice = (invoice: ModelInvoice) => {
  assert.is(invoice.objectName, "Invoice");
};

const assertIsDocumentFolder = (document: ModelDocumentFolder) => {
  assert.is(document.objectName, "DocumentFolder");
};

const assertIsDocument = (document: ModelDocument) => {
  assert.is(document.objectName, "Document");
};

const assertIsContact = (contact: ModelContact) => {
  assert.is(contact.objectName, "Contact");
};

const assertIsCommunicationWay = (communicationWay: ModelCommunicationWay) => {
  assert.is(communicationWay.objectName, "CommunicationWay");
};

const assertIsUnity = (unity: ModelUnity) => {
  assert.is(unity.objectName, "Unity");
};

test.run();
