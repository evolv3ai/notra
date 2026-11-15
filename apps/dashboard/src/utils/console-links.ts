import type { SiteConsoleAction } from "@notra/sites-core/types/sites";

import { NOTRA_CONSOLE_DEFAULT_URL } from "@/constants/slack-integration";

/**
 * Opens a site in the Notra console, with one of its moderation dialogs
 * already open. The console checks the admin role and asks for a reason and
 * a confirmation, so the link itself grants nothing.
 */
export function consoleSiteUrl(
  siteId: string,
  action?: SiteConsoleAction
): string {
  const url = new URL(
    "/moderate",
    process.env.NOTRA_CONSOLE_URL?.trim() || NOTRA_CONSOLE_DEFAULT_URL
  );
  url.searchParams.set("site", siteId);
  if (action) {
    url.searchParams.set("action", action);
  }
  return url.toString();
}
