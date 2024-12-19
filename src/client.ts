import NodeFormData from "form-data";
import { dependencies } from "./dependencies.js";
import { UnknownApiError } from "./errors.js";
import {
  ModelCommunicationWay,
  ModelContact,
  ModelContactAddress,
  ModelDocument,
  ModelDocumentFolder,
  ModelInvoice,
  ModelPaymentMethod,
  ModelSevUser,
  ModelTag,
  ModelUnity,
} from "./interfaces.js";
import { SevDeskUrls } from "./urls.js";

const DEFAULT_BASE_URL = "https://my.sevdesk.de/";

type UrlParamsFor<MethodName extends keyof SevDeskUrls> = Parameters<
  Extract<SevDeskUrls[MethodName], (...args: any) => any>
>[0];

export type SevDeskClientConfig = {
  apiKey: string;
  baseUrl?: string;
};

export class SevDeskClient {
  readonly config: Required<SevDeskClientConfig>;

  readonly urls: SevDeskUrls;

  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL }: SevDeskClientConfig) {
    this.config = {
      apiKey,
      baseUrl,
    };
    this.urls = new SevDeskUrls(baseUrl);
  }

  async request<ResponseBody>(url: string | URL, options: RequestInit = {}) {
    const { apiKey } = this.config;

    const response = await dependencies.fetch(url.toString(), {
      ...options,
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
        ...options.headers,
      },
    });
    let body;
    let error;

    try {
      body = await response.json();
    } catch (err: any) {
      error = err;
    }

    if (body?.error !== undefined) {
      const error = new Error();

      Object.assign(error, body.error);

      throw error;
    }
    if (response.ok === false || error) {
      const message = error?.message ?? body?.error?.message ?? body.message;

      throw new UnknownApiError(message, { response });
    }

    return body as ResponseBody;
  }

  // -------------------------------------------------------
  // Invoice
  // -------------------------------------------------------

  /**
   * Get an overview of all invoices.
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/Invoice/getInvoices
   */
  async getInvoices(params: UrlParamsFor<"apiGetInvoicesUrl"> = {}) {
    const url = this.urls.apiGetInvoicesUrl(params);

    return this.request<{
      objects: Array<Required<ModelInvoice>>;
    }>(url, { method: "GET" });
  }

  /**
   * Get a single invoice by id
   */
  async getInvoice(params: UrlParamsFor<"apiGetInvoiceUrl">) {
    const url = this.urls.apiGetInvoiceUrl(params);

    return this.request<{
      objects: [Required<ModelInvoice>];
    }>(url, { method: "GET" });
  }

  /**
   * Get the next invoice number
   */
  async getNextInvoiceNumber(
    params: UrlParamsFor<"apiGetNextInvoiceNumberUrl">
  ) {
    const url = this.urls.apiGetNextInvoiceNumberUrl(params);

    return this.request<{
      objects: string;
    }>(url, { method: "GET" });
  }

  /**
   * Create a new invoice
   */
  async saveInvoice(body: unknown) {
    const url = this.urls.apiSaveInvoiceUrl();

    return this.request<{
      objects: { invoice: Required<ModelInvoice> };
    }>(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  // -------------------------------------------------------
  // DocumentFolder
  // -------------------------------------------------------

  /**
   * Get an overview of all document folders
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/DocumentFolder/getDocumentFolders
   */
  async getDocumentFolders(
    params: UrlParamsFor<"apiGetDocumentFoldersUrl"> = {}
  ) {
    const url = this.urls.apiGetDocumentFoldersUrl(params);

    return this.request<{
      objects: Array<Required<ModelDocumentFolder>>;
    }>(url, { method: "GET" });
  }

  // -------------------------------------------------------
  // Document
  // -------------------------------------------------------

  /**
   * Get an overview of all documents
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/Document/getDocuments
   */
  async getDocuments(params: UrlParamsFor<"apiGetDocumentsUrl"> = {}) {
    const url = this.urls.apiGetDocumentsUrl(params);

    return this.request<{ objects: Array<Required<ModelDocument>> }>(url, {
      method: "GET",
    });
  }

  /**
   * Upload a file (creating a document)
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/Document/FactoryAddDocument
   */
  async addDocument({
    file,
    ...query
  }: UrlParamsFor<"apiFileUploadUrl"> & {
    file:
      | Parameters<FormData["append"]>[1]
      | Parameters<NodeFormData["append"]>[1];
  }) {
    const url = this.urls.apiFileUploadUrl(query);
    const form = new dependencies.FormData();

    form.append("files", file);

    return this.request<{ objects: [Required<ModelDocument>] }>(url, {
      method: "POST",
      body: form,
    });
  }

  // -------------------------------------------------------
  // Contact
  // -------------------------------------------------------

  /**
   * Get an overview of all contacts
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/Contact/getContacts
   */
  async getContacts(params: UrlParamsFor<"apiGetContactsUrl"> = {}) {
    const url = this.urls.apiGetContactsUrl(params);

    return this.request<{ objects: Array<Required<ModelContact>> }>(url, {
      method: "GET",
    });
  }

  // -------------------------------------------------------
  // ContactAddress
  // -------------------------------------------------------

  /**
   * Get an overview of all contact addresses
   */
  async getContactAddresses(
    params: UrlParamsFor<"apiGetContactAddressesUrl"> = {}
  ) {
    const url = this.urls.apiGetContactAddressesUrl(params);

    return this.request<{ objects: Array<Required<ModelContactAddress>> }>(
      url,
      {
        method: "GET",
      }
    );
  }

  // -------------------------------------------------------
  // CommunicationWay
  // -------------------------------------------------------

  /**
   * Get an overview of all communication ways
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/CommunicationWay/getCommunicationWays
   */
  async getCommunicationWays(
    params: UrlParamsFor<"apiGetCommunicationWaysUrl"> = {}
  ) {
    const url = this.urls.apiGetCommunicationWaysUrl(params);

    return this.request<{ objects: Array<Required<ModelCommunicationWay>> }>(
      url,
      {
        method: "GET",
      }
    );
  }

  // -------------------------------------------------------
  // Unity
  // -------------------------------------------------------

  /**
   * Get an overview of all unities
   *
   * @see https://my.sevdesk.de/swaggerUI/index.html#/Unity/getUnities
   */
  async getUnities(params: UrlParamsFor<"apiGetUnitiesUrl"> = {}) {
    const url = this.urls.apiGetUnitiesUrl(params);

    return this.request<{ objects: Array<Required<ModelUnity>> }>(url, {
      method: "GET",
    });
  }

  // -------------------------------------------------------
  // PaymentMethod
  // -------------------------------------------------------

  /**
   * Get an overview of all payment methods
   */
  async getPaymentMethods(
    params: UrlParamsFor<"apiGetPaymentMethodsUrl"> = {}
  ) {
    const url = this.urls.apiGetPaymentMethodsUrl(params);

    return this.request<{ objects: Array<Required<ModelPaymentMethod>> }>(url, {
      method: "GET",
    });
  }

  // -------------------------------------------------------
  // Tag
  // -------------------------------------------------------

  /**
   * Get an overview of all tags
   */
  async getTags(params: UrlParamsFor<"apiGetTagsUrl"> = {}) {
    const url = this.urls.apiGetTagsUrl(params);

    return this.request<{ objects: Array<Required<ModelTag>> }>(url, {
      method: "GET",
    });
  }

  // -------------------------------------------------------
  // SevUser
  // -------------------------------------------------------

  /**
   * Get an overview of all users
   */
  async getSevUsers(params: UrlParamsFor<"apiGetSevUsersUrl"> = {}) {
    const url = this.urls.apiGetSevUsersUrl(params);

    return this.request<{ objects: Array<Required<ModelSevUser>> }>(url, {
      method: "GET",
    });
  }

  // // pending invoices from sevdesk includes also outstanding / due invoices
  // // we remove them with a filter but you could also include the if you only need everything pending
  // async getPendingInvoices(options = { includeOutstanding: false }) {
  //   const allPendingInvoices = await this.getAllInvoices({
  //     status: "200",
  //   });

  //   return options.includeOutstanding
  //     ? allPendingInvoices
  //     : allPendingInvoices.filter(({ invoiceDate, timeToPay }) =>
  //         isBefore(
  //           Date.now(),
  //           addDays(new Date(invoiceDate), Number(timeToPay))
  //         )
  //       );
  // }

  // async getOutstandingInvoices() {
  //   const pendingInvoice = await this.getPendingInvoices({
  //     includeOutstanding: true,
  //   });

  //   return pendingInvoice.filter(({ invoiceDate, timeToPay }) =>
  //     isAfter(Date.now(), addDays(new Date(invoiceDate), Number(timeToPay)))
  //   );
  // }

  // async getBilledAmount(orderId) {
  //   const invoices = await this.getAllInvoices();

  //   return invoices
  //     .filter((invoice) => {
  //       return (
  //         invoice.origin !== undefined &&
  //         invoice.origin.id === orderId.toString()
  //       );
  //     })
  //     .reduce((sum, { sumNet }) => {
  //       sum += parseInt(sumNet);

  //       return sum;
  //     }, 0);
  // }

  // async getOrderTotalNet(orderId) {
  //   const options = {
  //     method: "GET",
  //   };

  //   return this.request(
  //     `https://my.sevdesk.de/api/v1/Order/${orderId}/getTotalNet`,
  //     options
  //   );
  // }

  // async getRemainingOrderBudget(orderId) {
  //   const totalNet = await this.getOrderTotalNet(orderId);
  //   const alreadyBilledAmount = await this.getBilledAmount(orderId);

  //   return totalNet - alreadyBilledAmount;
  // }

  // async getTextTemplates(language = "DE") {
  //   const options = {
  //     method: "GET",
  //   };

  //   const templates = await this.request(
  //     "https://my.sevdesk.de/api/v1/TextTemplate",
  //     options
  //   );

  //   const textTemplates = {
  //     DE: {
  //       RE: {
  //         HEAD: null,
  //         FOOT: null,
  //       },
  //     },
  //     EN: {
  //       RE: {
  //         HEAD: null,
  //         FOOT: null,
  //       },
  //     },
  //   };

  //   templates
  //     // TODO remove filter and add english templates for Offer, E-mail, etc. (https://my.sevdesk.de/#/admin/texttemplate)
  //     .filter((template) => template.objectType === "RE")
  //     .forEach((template) => {
  //       const { objectType, textType, name, text } = template;

  //       textTemplates[name === "Standard" ? "DE" : "EN"][objectType][textType] =
  //         text;
  //     });

  //   return textTemplates[language];
  // }
}
