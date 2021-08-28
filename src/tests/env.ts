import env from "env-var";

export const TEST_SEVDESK_API_TOKEN = env
  .get("TEST_SEVDESK_API_TOKEN")
  .required()
  .asString();
