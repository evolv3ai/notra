import { INTH_OAUTH_AUTHORIZE_PATH } from "@notra/sites-server/constants/inth";

import { INTH_OAUTH_ERRORS } from "@/constants/site-consent";
import type { InthOAuthErrorCode } from "@/types/site-consent";

export function inthAuthorizeHref(
  organizationId: string,
  callbackPath: string
): string {
  return `${INTH_OAUTH_AUTHORIZE_PATH}?${new URLSearchParams({
    organizationId,
    callbackPath,
  }).toString()}`;
}

/** Returns to the same page, section and branch, without a previous OAuth result. */
export function inthCallbackPath(
  pathname: string,
  searchParams: URLSearchParams
): string {
  const query = new URLSearchParams(searchParams);
  query.delete("error");
  query.delete("inthConnected");
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function inthOAuthError(
  value: string | null
): InthOAuthErrorCode | null {
  return INTH_OAUTH_ERRORS.find((code) => code === value) ?? null;
}

export function c15tConfigExample(backendURL: string): string {
  return JSON.stringify({ integrations: { c15t: { backendURL } } }, null, 2);
}
