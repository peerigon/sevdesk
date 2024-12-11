import env from "env-var";

export const TEST_SEVDESK_API_TOKEN = env
  .get("TEST_SEVDESK_API_TOKEN")
  .required()
  .asString();

export const CONTACT_PERSON_ID = env
  .get("CONTACT_PERSON_ID")
  .required()
  .asString();
