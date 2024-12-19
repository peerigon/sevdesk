const DEFAULT_BASE_URL = "https://my.sevdesk.de/";

type Query = Record<string, any>;

type DefaultCollectionQuery = {
  limit?: number;
  offset?: number;
  embed?: Array<string>;
};

export class SevDeskUrls {
  constructor(private baseUrl = DEFAULT_BASE_URL) {}

  apiUrl({
    version = 1,
    path,
    query = {},
  }: {
    version?: number;
    path: string;
    query?: Query;
  }) {
    const url = new URL(path, `${this.baseUrl}api/v${version}/`);

    Object.entries(query).forEach(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];

      values.forEach((value) => {
        url.searchParams.append(key, value);
      });
    });

    return url.toString();
  }

  // -------------------------------------------------------
  // Invoice
  // -------------------------------------------------------

  apiGetInvoicesUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({ path: `Invoice`, query });
  }

  apiGetInvoiceUrl({ id, ...query }: { id: string } & Query) {
    return this.apiUrl({ path: `Invoice/${id}`, query });
  }

  apiGetNextInvoiceNumberUrl({
    ...query
  }: { invoiceType: string; useNextNumber: boolean } & Query) {
    return this.apiUrl({ path: `Invoice/Factory/getNextInvoiceNumber`, query });
  }

  apiSaveInvoiceUrl({ ...query }: Query = {}) {
    return this.apiUrl({ path: `Invoice/Factory/saveInvoice`, query });
  }

  viewInvoiceUrl({ id }: { id: string }) {
    return `${this.baseUrl}#/fi/edit/type/RE/id/${id}`;
  }

  // -------------------------------------------------------
  // DocumentFolders
  // -------------------------------------------------------

  apiGetDocumentFoldersUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({ path: `DocumentFolder`, query });
  }

  // -------------------------------------------------------
  // Document
  // -------------------------------------------------------

  apiGetDocumentsUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({ path: `Document`, query });
  }

  apiFileUploadUrl({
    // The root folder is "null"
    folder = "null",
    ...query
  }: { object?: string; folder?: string } & Query = {}) {
    return this.apiUrl({
      path: `Document/Factory/fileUpload`,
      query: { folder, ...query },
    });
  }

  // -------------------------------------------------------
  // Contact
  // -------------------------------------------------------

  apiGetContactsUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `Contact`,
      query,
    });
  }

  // -------------------------------------------------------
  // ContactAddress
  // -------------------------------------------------------

  apiGetContactAddressesUrl({
    contactId,
    ...query
  }: { contactId?: string | undefined } & DefaultCollectionQuery & Query = {}) {
    if (contactId) {
      return this.apiUrl({
        path: `Contact/${contactId}/getAddresses`,
        query,
      });
    }

    return this.apiUrl({
      path: `ContactAddress`,
      query,
    });
  }

  // -------------------------------------------------------
  // CommunicationWay
  // -------------------------------------------------------

  apiGetCommunicationWaysUrl({
    ...query
  }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `CommunicationWay`,
      query,
    });
  }

  // -------------------------------------------------------
  // Unity
  // -------------------------------------------------------

  apiGetUnitiesUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `Unity`,
      query,
    });
  }

  // -------------------------------------------------------
  // PaymentMethod
  // -------------------------------------------------------

  apiGetPaymentMethodsUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `PaymentMethod`,
      query,
    });
  }

  // -------------------------------------------------------
  // Tag
  // -------------------------------------------------------

  apiGetTagsUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `Tag`,
      query,
    });
  }

  // -------------------------------------------------------
  // SevUser
  // -------------------------------------------------------

  apiGetSevUsersUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `SevUser`,
      query,
    });
  }

  // -------------------------------------------------------
  // StaticCountry
  // -------------------------------------------------------

  apiGetStaticCountriesUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `StaticCountry`,
      query,
    });
  }

  // -------------------------------------------------------
  // Part
  // -------------------------------------------------------

  apiGetPartsUrl({ ...query }: DefaultCollectionQuery & Query = {}) {
    return this.apiUrl({
      path: `Part`,
      query,
    });
  }
}
