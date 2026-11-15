import { SITE_PREVIEW_COOKIE } from "@notra/sites-core/constants/sites";

import {
  PREVIEW_COOKIE_MAX_CANDIDATES,
  PREVIEW_SECURE_COOKIE,
} from "../constants/preview-auth";

/**
 * `__Host-` cookies can't carry a Domain attribute, so another tenant on the
 * shared hosting domain can't plant one for this host. The prefix requires
 * Secure, so plain-http local dev keeps the unprefixed name.
 */
export function previewCookieName(url: URL): string {
  return url.protocol === "https:"
    ? PREVIEW_SECURE_COOKIE
    : SITE_PREVIEW_COOKIE;
}

/**
 * Values sent under `name`; browsers may send duplicates. Capped so a padded
 * Cookie header can't force one signature check per value.
 */
export function readCookies(request: Request, name: string): string[] {
  const header = request.headers.get("Cookie");
  if (!header) {
    return [];
  }
  const values: string[] = [];
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      values.push(rest.join("="));
      if (values.length >= PREVIEW_COOKIE_MAX_CANDIDATES) {
        break;
      }
    }
  }
  return values;
}
