import { Tick02Icon } from "@hugeicons/core-free-icons";
import { Databuddy } from "@notra/ui/components/ui/svgs/databuddy";
import { GoogleAnalytics } from "@notra/ui/components/ui/svgs/googleAnalytics";
import { Plausible } from "@notra/ui/components/ui/svgs/plausible";
import { PostHog } from "@notra/ui/components/ui/svgs/posthog";
import { Umami } from "@notra/ui/components/ui/svgs/umami";

import type { StatusBadgeAppearance } from "@/types/components/status-badge";
import type { SiteIntegrationProvider } from "@/types/site-integrations";

export const SITE_INTEGRATION_ACTIVE_BADGE: StatusBadgeAppearance = {
  variant: "success",
  icon: Tick02Icon,
  square: true,
};

export const SITE_INTEGRATION_AUTOSAVE_DELAY_MS = 600;

export const SITE_INTEGRATION_AUTOSAVE_MESSAGES = {
  idle: null,
  pending: "autosavePending",
  saving: "autosaveSaving",
  saved: "autosaveSaved",
  error: "saveFailed",
} as const;

export const SITE_INTEGRATION_PROVIDERS: readonly SiteIntegrationProvider[] = [
  {
    id: "databuddy",
    name: "Databuddy",
    logo: Databuddy,
    docsUrl: "https://www.databuddy.cc/docs",
    recommended: true,
    fields: [
      { key: "clientId", placeholder: "3ed1fce1-5a56-4cbc-a917-66864f6d18e3" },
      { key: "trackWebVitals", type: "boolean", defaultValue: false },
      { key: "trackErrors", type: "boolean", defaultValue: false },
      { key: "trackOutgoingLinks", type: "boolean", defaultValue: false },
      { key: "trackInteractions", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    logo: GoogleAnalytics,
    docsUrl: "https://support.google.com/analytics/answer/9539598",
    fields: [{ key: "measurementId", placeholder: "G-XXXXXXXXXX" }],
  },
  {
    id: "plausible",
    name: "Plausible",
    logo: Plausible,
    docsUrl: "https://plausible.io/docs",
    fields: [
      { key: "domain", placeholder: "acme.com" },
      { key: "server", placeholder: "plausible.acme.com", optional: true },
    ],
  },
  {
    id: "posthog",
    name: "PostHog",
    logo: PostHog,
    docsUrl: "https://posthog.com/docs",
    fields: [
      { key: "apiKey", placeholder: "phc_…" },
      {
        key: "apiHost",
        placeholder: "https://us.i.posthog.com",
        optional: true,
      },
      { key: "sessionRecording", type: "boolean", defaultValue: true },
    ],
  },
  {
    id: "umami",
    name: "Umami",
    logo: Umami,
    docsUrl: "https://docs.umami.is/docs/collect-data",
    fields: [
      { key: "websiteId", placeholder: "94db1cb1-74f4-4a40-ad6c-962362670409" },
      {
        key: "scriptUrl",
        placeholder: "https://cloud.umami.is/script.js",
        optional: true,
      },
      { key: "hostUrl", placeholder: "https://stats.acme.com", optional: true },
    ],
  },
];
