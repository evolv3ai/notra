import { googleFaviconUrl } from "@notra/utils/google-favicon";

import {
  GEO_FAVICON_SIZE,
  GEO_LOGO_LINK_BASE_URL,
} from "@/constants/geo-report";

function normalizeDomain(domain: string) {
  const trimmed = domain.trim().toLowerCase();
  const withProtocol = trimmed.startsWith("http")
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return trimmed;
  }
}

/**
 * context.dev Logo Link URL for a domain. `type=icon` keeps marks square; no
 * `theme` so the highest-resolution icon comes back (themed variants can be
 * wordmarks).
 * Returns `undefined` when `NEXT_PUBLIC_LOGOLINK_CLIENT_ID` is not configured.
 */
function getLogoLinkUrl(domain: string) {
  const clientId = process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID;
  if (!clientId) {
    return;
  }
  const url = new URL(GEO_LOGO_LINK_BASE_URL);
  url.searchParams.set("publicClientId", clientId);
  url.searchParams.set("domain", domain);
  url.searchParams.set("type", "icon");
  return url.toString();
}

/** Ordered logo URLs to try: Logo Link first, favicon as the fallback. */
export function getBrandLogoCandidates(domain: string) {
  const hostname = normalizeDomain(domain);
  const candidates: string[] = [];
  const logoLink = getLogoLinkUrl(hostname);
  if (logoLink) {
    candidates.push(logoLink);
  }
  const favicon = googleFaviconUrl(hostname, GEO_FAVICON_SIZE);
  if (favicon) {
    candidates.push(favicon);
  }
  return candidates;
}

export function getBrandInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase() || "?";
}
