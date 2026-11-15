import {
  googleFaviconUrl,
  isReservedExampleDomain,
} from "@notra/utils/google-favicon";

import { GEO_NOTRA_LOGO_PATH } from "../constants/geo";

export function competitorLogoSources(
  domain: string | null,
  logo: string | null
): string[] {
  const sources: string[] = [];
  if (logo) {
    sources.push(logo);
  }
  const favicon = googleFaviconUrl(domain);
  if (favicon) {
    sources.push(favicon);
  }
  return sources;
}

export function projectLogoSources(
  domain: string | null,
  fallback: string,
  logo: string | null
): string[] {
  return [
    ...competitorLogoSources(domain, logo),
    isReservedExampleDomain(domain) ? GEO_NOTRA_LOGO_PATH : fallback,
  ];
}
