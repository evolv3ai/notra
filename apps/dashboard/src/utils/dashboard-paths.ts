import { getOrganizationSlugFromPathname } from "@/utils/organization-pathname";

export function isContentDetailPathname(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  const organizationSlug = getOrganizationSlugFromPathname(pathname);
  if (!organizationSlug) {
    return false;
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments[1] === "content" && segments.length >= 3;
}

/** A standalone chat already is the agent, so it skips the topbar agent button. */
export function isChatPathname(pathname: string | null): boolean {
  return pathname?.split("/").filter(Boolean)[1] === "chat";
}

/**
 * Pages whose topbar does more than repeat breadcrumbs: a post (its actions),
 * a chat (rename, pin, delete) and brand identity (the identity picker).
 * Every other page titles itself and gets no topbar on desktop.
 */
export function isRecordDetailPathname(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  const [slug, section, detail] = pathname.split("/").filter(Boolean);
  if (!slug || !section) {
    return false;
  }
  if (section === "brand") {
    return detail === "identity";
  }
  return (section === "chat" || section === "content") && Boolean(detail);
}
