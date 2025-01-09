import "./tests/setup.js";
import * as fs from "fs";
import { test } from "uvu";
import * as assert from "uvu/assert";
import { SevDeskClient } from "./client.js";
import * as env from "./tests/env.js";
import {
  ModelCommunicationWay,
  ModelContact,
  ModelContactAddress,
  ModelDocument,
  ModelDocumentFolder,
  ModelInvoice,
  ModelPart,
  ModelPaymentMethod,
  ModelSevUser,
  ModelStaticCountry,
  ModelTag,
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

// Manual test
// If you run this test, you need to clean up manually afterwards
test.skip("Create a new invoice", async () => {
  const contactId = 123;
  const contactPersonId = 123;
  const invoiceNumber = `TEST-${new Date().toISOString()}`;

  const {
    objects: { invoice },
  } = await sevDeskClient.saveInvoice({
    invoice: {
      // id: null,
      objectName: "Invoice",
      invoiceNumber,
      contact: {
        id: contactId,
        objectName: "Contact",
      },
      contactPerson: {
        id: contactPersonId,
        objectName: "SevUser",
      },
      invoiceDate: "01.01.2022",
      header: `Invoice ${invoiceNumber}`,
      headText: "header information",
      footText: "footer information",
      timeToPay: 20,
      discount: 0,
      address: "name\nstreet\npostCode city",
      addressCountry: {
        id: 1,
        objectName: "StaticCountry",
      },
      payDate: "2019-08-24T14:15:22Z",
      deliveryDate: "01.01.2022",
      deliveryDateUntil: null,
      status: "100",
      smallSettlement: 0,
      taxRate: 0,
      taxRule: {
        id: "1",
        objectName: "TaxRule",
      },
      taxText: "Umsatzsteuer 19%",
      taxType: "default",
      taxSet: null,
      paymentMethod: {
        id: 21919,
        objectName: "PaymentMethod",
      },
      sendDate: "01.01.2020",
      invoiceType: "RE",
      currency: "EUR",
      showNet: "1",
      sendType: "VPR",
      origin: null,
      customerInternalNote: null,
      propertyIsEInvoice: false,
      mapAll: true,
    },
    invoicePosSave: [
      {
        id: null,
        objectName: "InvoicePos",
        mapAll: true,
        quantity: 1,
        price: 100,
        name: "Dragonglass",
        unity: {
          id: 1,
          objectName: "Unity",
        },
        positionNumber: 0,
        text: "string",
        discount: 0.1,
        taxRate: 19,
        priceGross: 100,
        priceTax: 0.1,
      },
    ],
    invoicePosDelete: null,
    filename: "string",
    discountSave: [
      {
        discount: "true",
        text: "string",
        percentage: true,
        value: 0,
        objectName: "Discounts",
        mapAll: "true",
      },
    ],
    discountDelete: null,
  });

  assertIsInvoice(invoice);
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

// Manual test
// If you run this test, you need to clean up manually afterwards
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

test("Get contact addresses (without contact ID)", async () => {
  const { objects: contactAddresses } =
    await sevDeskClient.getContactAddresses();

  assert.is(contactAddresses.length > 0, true);
  contactAddresses.forEach(assertIsContactAddress);
});

test("Get contact addresses (with contact ID)", async () => {
  const { objects: contacts } = await sevDeskClient.getContacts();
  const { objects: contactAddresses } = await sevDeskClient.getContactAddresses(
    { contactId: contacts[0].id }
  );

  assert.is(contactAddresses.length > 0, true);
  contactAddresses.forEach(assertIsContactAddress);
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

test("Get payment methods", async () => {
  const { objects: paymentMethods } = await sevDeskClient.getPaymentMethods();

  assert.is(paymentMethods.length > 0, true);
  paymentMethods.forEach(assertIsPaymentMethod);
});

test("Get tags", async () => {
  const { objects: tags } = await sevDeskClient.getTags();

  assert.is(tags.length > 0, true);
  tags.forEach(assertIsTag);
});

test("Get users", async () => {
  const { objects: users } = await sevDeskClient.getSevUsers();

  assert.is(users.length > 0, true);
  users.forEach(assertIsSevUser);
});

test("Get static countries", async () => {
  const { objects: countries } = await sevDeskClient.getStaticCountries();

  assert.is(countries.length > 0, true);
  countries.forEach(assertIsStaticCountry);
});

test("Get parts", async () => {
  const { objects: parts } = await sevDeskClient.getParts();

  assert.is(parts.length > 0, true);
  parts.forEach(assertIsPart);
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

const assertIsContactAddress = (contact: ModelContactAddress) => {
  assert.is(contact.objectName, "ContactAddress");
};

const assertIsCommunicationWay = (communicationWay: ModelCommunicationWay) => {
  assert.is(communicationWay.objectName, "CommunicationWay");
};

const assertIsUnity = (unity: ModelUnity) => {
  assert.is(unity.objectName, "Unity");
};

const assertIsPaymentMethod = (paymentMethod: ModelPaymentMethod) => {
  assert.is(paymentMethod.objectName, "PaymentMethod");
};

const assertIsTag = (tag: ModelTag) => {
  assert.is(tag.objectName, "Tag");
};

const assertIsSevUser = (user: ModelSevUser) => {
  assert.is(user.objectName, "SevUser");
};

const assertIsStaticCountry = (user: ModelStaticCountry) => {
  assert.is(user.objectName, "StaticCountry");
};

const assertIsPart = (part: ModelPart) => {
  assert.is(part.objectName, "Part");
};

test.run();
