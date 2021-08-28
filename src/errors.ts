const createCode = (code: string) => `@peerigon/sevdesk/${code}` as const;

export class UnknownApiError extends Error {
  code = createCode("UNKNOWN_API_ERROR");

  response: any;

  constructor(message = "Unknown API error", { response }: { response: any }) {
    super(message);
    this.response = response;
  }
}
