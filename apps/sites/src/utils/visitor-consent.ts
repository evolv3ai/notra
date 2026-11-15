import { readRequestConsent } from "@c15t/core/server";
import { C15T_ANALYTICS_CATEGORY } from "@notra/sites-core/constants/integrations";
import type { SiteManifest } from "@notra/sites-core/types/deployment";

const onDomain = (hostname: string, domain: string) =>
  `.${hostname}`.endsWith(`.${domain}`);

export function visitorConsent(
  manifest: SiteManifest,
  headers: Headers,
  host: string,
  hostingDomain: string
): boolean | undefined {
  if (manifest.analyticsConsent !== true) {
    return undefined;
  }
  if (
    !manifest.consentStorageKey &&
    onDomain(host, hostingDomain) &&
    !onDomain(new URL(manifest.target.publicOrigin).hostname, hostingDomain)
  ) {
    return false;
  }
  const { state } = readRequestConsent({
    adapter: "@notra/sites",
    request: { headers },
    storage: { storageKey: manifest.consentStorageKey },
  });
  return (
    state.initialRecords?.choice?.categories[C15T_ANALYTICS_CATEGORY]?.value ===
    true
  );
}
