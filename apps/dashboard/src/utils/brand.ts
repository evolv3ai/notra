import { googleFaviconUrl } from "@notra/utils/google-favicon";
import { logoLinkUrl } from "@notra/utils/logo-link";

export function getWebsiteDomain(websiteUrl: string | null): string | null {
  if (!websiteUrl) {
    return null;
  }
  const normalizedUrl = websiteUrl.startsWith("http")
    ? websiteUrl
    : `https://${websiteUrl}`;
  try {
    return new URL(normalizedUrl).hostname;
  } catch {
    return null;
  }
}

export function getBrandFaviconUrl(websiteUrl: string | null) {
  return logoLinkUrl(getWebsiteDomain(websiteUrl)) ?? undefined;
}

export function getGoogleFaviconUrl(domain: string | null): string | undefined {
  return googleFaviconUrl(domain) ?? undefined;
}
