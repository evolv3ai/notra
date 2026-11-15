import { SITE_CONSOLE_ACTIONS } from "@notra/sites-core/constants/sites";

/**
 * Where a slug-less deep link such as `/moderate?site=…&action=…` lands
 * inside the admin's own workspace. Unknown actions are dropped, so a link
 * can only ever open a dialog, never act.
 */
export function moderationRedirectPath(
  slug: string,
  params: { site?: string | string[]; action?: string | string[] }
): string {
  const site = typeof params.site === "string" ? params.site.trim() : "";
  if (!site) {
    return `/${slug}/moderation`;
  }
  const action = SITE_CONSOLE_ACTIONS.find((value) => value === params.action);
  const path = `/${slug}/sites/${encodeURIComponent(site)}`;
  return action ? `${path}?action=${action}` : path;
}

/** The slug-less link itself, kept whole so sign-in returns to it. */
export function moderationLinkPath(params: {
  site?: string | string[];
  action?: string | string[];
}): string {
  const query = new URLSearchParams();
  for (const key of ["site", "action"] as const) {
    const value = params[key];
    if (typeof value === "string") {
      query.set(key, value);
    }
  }
  const search = query.toString();
  return search ? `/moderate?${search}` : "/moderate";
}
