import { INTH_OAUTH_CALLBACK_PATH } from "@notra/sites-server/constants/inth";

export const getInthRedirectUri = (baseUrl: string): string =>
  new URL(INTH_OAUTH_CALLBACK_PATH, baseUrl).toString();
