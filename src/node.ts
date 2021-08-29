import fetch from "node-fetch";
import FormData from "form-data";
import { dependencies } from "./dependencies.js";

// @ts-expect-error Our polyfill doesn't match all fetch features, but it's enough for our use-case
dependencies.fetch = fetch;
// @ts-expect-error Our polyfill doesn't match all FormData features, but it's enough for our use-case
dependencies.FormData = FormData;

export * from "./main.js";
