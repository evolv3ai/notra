import {
  C15T_ANALYTICS_CATEGORY,
  C15T_HOST_STORAGE_KEY,
  POSTHOG_DEFAULT_API_HOST,
} from "@notra/sites-core/constants/integrations";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import type { SiteIntegrations } from "@notra/sites-core/types/site-integrations";
import { analyticsGatedByConsent } from "@notra/sites-core/utils/integrations";

import type {
  SiteConsentAnalytics,
  SiteConsentParams,
} from "../../src/types/build-params";
import {
  CONSENT_RADII,
  DATABUDDY_CONNECTION_KEYS,
  CONSENT_SHADOWS,
  CONSENT_SITE_COLORS,
} from "../constants/consent";
import type { PreparedCustomScript } from "../types/source";

function consentAnalytics({
  databuddy,
  ga4,
  plausible,
  posthog,
  umami,
}: SiteIntegrations): SiteConsentAnalytics {
  const databuddyConfig = databuddy && {
    clientId: databuddy.clientId,
    scriptUrl: databuddy.scriptUrl,
    apiUrl: databuddy.apiUrl,
    replay: databuddy.replay,
    options: Object.fromEntries(
      Object.entries(databuddy).filter(
        ([key]) => !DATABUDDY_CONNECTION_KEYS.has(key)
      )
    ),
  };
  return {
    databuddy: databuddyConfig,
    gtag: ga4 && { id: ga4.measurementId },
    posthog: posthog && {
      id: posthog.apiKey,
      apiHost: posthog.apiHost ?? POSTHOG_DEFAULT_API_HOST,
      disableSessionRecording: posthog.sessionRecording === false,
    },
    plausible: plausible && {
      domain: plausible.domain,
      scriptUrl: plausible.server
        ? `https://${plausible.server}/js/script.js`
        : undefined,
    },
    umami: umami && {
      websiteId: umami.websiteId,
      scriptUrl: umami.scriptUrl,
      hostUrl: umami.hostUrl,
    },
  };
}

function onHostingDomain(publicOrigin: string, hostingDomain?: string) {
  return (
    hostingDomain !== undefined &&
    `.${new URL(publicOrigin).hostname}`.endsWith(`.${hostingDomain}`)
  );
}

export function siteConsent(
  config: SiteConfig,
  customScripts: readonly PreparedCustomScript[],
  analytics: boolean,
  dev: boolean,
  publicOrigin: string,
  hostingDomain?: string
): SiteConsentParams | null {
  const { c15t } = config.integrations;
  if (!c15t) {
    return null;
  }
  const gated = c15t.scripts ?? {};
  const crossSubdomain =
    c15t.crossSubdomain && !onHostingDomain(publicOrigin, hostingDomain);
  return {
    backendURL: analytics ? c15t.backendURL : null,
    devTools: dev && c15t.devTools,
    hideBranding: c15t.hideBranding ?? false,
    analytics:
      analytics && analyticsGatedByConsent(config.integrations)
        ? consentAnalytics(config.integrations)
        : null,
    scripts: customScripts.flatMap((script) => {
      const category = gated[script.path];
      return category ? [{ fileName: script.fileName, category }] : [];
    }),
    options: {
      ui: "react",
      colorScheme: "none",
      consentCategories: analytics ? [C15T_ANALYTICS_CATEGORY] : undefined,
      presentation: { prompt: c15t.prompt, preferences: c15t.preferences },
      legalLinks: c15t.legalLinks,
      i18n: c15t.locale
        ? { locale: c15t.locale, detectLanguage: false }
        : undefined,
      storageConfig: {
        defaultDomain: crossSubdomain
          ? `.${new URL(publicOrigin).hostname.split(".").slice(-2).join(".")}`
          : undefined,
        defaultExpiryDays: c15t.expiryDays,
        storageKey:
          crossSubdomain || !publicOrigin.startsWith("https:")
            ? undefined
            : C15T_HOST_STORAGE_KEY,
      },
      disableAnimation: c15t.disableAnimation,
      theme: {
        colors: { ...CONSENT_SITE_COLORS, ...c15t.theme?.colors },
        dark: { ...CONSENT_SITE_COLORS, ...c15t.theme?.dark },
        typography: { fontFamily: "var(--font-body)" },
        radius: CONSENT_RADII[c15t.theme?.radius ?? "medium"],
        shadows: CONSENT_SHADOWS,
      },
    },
  };
}

export function consentDiagnostics(
  config: SiteConfig,
  customScripts: readonly PreparedCustomScript[],
  publicOrigin: string,
  hostingDomain?: string
): SiteDiagnostic[] {
  const paths = new Set(customScripts.map((script) => script.path));
  const diagnostics = Object.keys(config.integrations.c15t?.scripts ?? {})
    .filter((path) => !paths.has(path))
    .map((path): SiteDiagnostic => ({
      severity: "error",
      file: "blog.json",
      code: "consent_script_missing",
      message: `integrations.c15t.scripts lists ${path}, but there is no custom script at that path.`,
    }));
  if (
    config.integrations.c15t?.crossSubdomain &&
    onHostingDomain(publicOrigin, hostingDomain)
  ) {
    diagnostics.push({
      severity: "warning",
      file: "blog.json",
      code: "consent_cross_subdomain_ignored",
      message: `integrations.c15t.crossSubdomain only applies on your own domain. On ${hostingDomain} the consent choice stays on this site's host, so other sites there can't read or change it.`,
    });
  }
  return diagnostics;
}
