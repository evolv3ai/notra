import "@/lib/analytics/client-init";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ConsentBanner,
  ConsentDialog,
  ConsentRoot,
  ConsentTheme,
  local,
} from "c15t/tanstack-start";
import { use } from "react";
import { IntlProvider } from "use-intl";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";

import { NotFoundContent } from "@/components/not-found-content";
import {
  DUB_ANALYTICS_SCRIPTS,
  DUB_CLEAR_ON_REVOCATION,
} from "@/constants/dub";
import { resolveDashboardConsent } from "@/lib/consent-manager/resolve";
import { consentComponents, consentTheme } from "@/lib/consent-manager/theme";
import {
  catalogPreloadLinks,
  getCatalog,
  loadCatalog,
} from "@/lib/i18n/catalog";
import { getEmbedLocale, getLocale } from "@/lib/i18n/server";
import dynamic from "@/utils/lazy-component";
import { Providers } from "@/utils/providers";
import { isTrafficEmbedPath, trafficEmbedTheme } from "@/utils/traffic-embed";

import styles from "@/styles/globals.css?url";

const DatabuddyAnalytics = dynamic(
  () =>
    import("@/components/providers/databuddy-analytics").then(
      (module) => module.DatabuddyAnalytics
    ),
  { ssr: false }
);

const loadRootState = createServerFn({ method: "GET" })
  .validator((data: { embedLocale?: unknown } | undefined) => data)
  .handler(async ({ data }) => {
    // Embeds render on other companies' sites: their visitors get no consent
    // banner and no analytics, and the language comes from the embed URL.
    if (data) {
      return { locale: getEmbedLocale(data.embedLocale), consent: null };
    }
    const locale = await getLocale();
    const consent = await resolveDashboardConsent(locale);
    return { locale, consent };
  });

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>) => search,
  loader: async ({ location }) => {
    const embed = isTrafficEmbedPath(location.pathname);
    const search = location.search as Record<string, unknown>;
    const { locale, consent } = await loadRootState({
      data: embed ? { embedLocale: search.locale } : undefined,
    });
    await loadCatalog(locale);
    return {
      locale,
      consent,
      embedTheme: embed ? trafficEmbedTheme(search.theme) : null,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Notra" },
      { name: "description", content: "Notra - Content Management" },
      { name: "apple-mobile-web-app-title", content: "Notra" },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#ffffff",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#0e0f12",
      },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      ...catalogPreloadLinks(loaderData?.locale),
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", href: "/icon0.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
    ],
  }),
  component: Root,
  notFoundComponent: () => <NotFoundContent className="min-h-[100svh]" />,
});

function Root() {
  const { locale, consent, embedTheme } = Route.useLoaderData();
  const messages = getCatalog(locale) ?? use(loadCatalog(locale));
  const embed = embedTheme !== null;
  const app = (
    <IntlProvider locale={locale} messages={messages} timeZone="UTC">
      <Providers
        embed={embed}
        forcedTheme={
          embedTheme === null || embedTheme === "auto" ? undefined : embedTheme
        }
      >
        <Outlet />
      </Providers>
    </IntlProvider>
  );
  return (
    <html className="dark:scheme-dark" lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className={embed ? "bg-transparent antialiased" : "antialiased"}>
        {consent === null ? (
          // The demo has no consent backend, banner or analytics, but
          // components still read consent through c15t hooks.
          <ConsentRoot
            options={{
              consentCategories: ["necessary", "measurement"],
              mode: local({ acknowledgeNoRecords: true }),
            }}
            state={{}}
          >
            {app}
          </ConsentRoot>
        ) : (
          <>
            <ConsentTheme theme={consentTheme} />
            <ConsentRoot
              options={{
                consentCategories: ["necessary", "measurement"],
                theme: consentTheme,
                components: consentComponents,
                ...(process.env.NODE_ENV === "production"
                  ? {}
                  : { mode: local() }),
              }}
              clearOnRevocation={DUB_CLEAR_ON_REVOCATION}
              scripts={DUB_ANALYTICS_SCRIPTS}
              state={consent}
            >
              {app}
              <DatabuddyAnalytics />
              <ConsentBanner />
              <ConsentDialog />
            </ConsentRoot>
          </>
        )}
        <Scripts />
      </body>
    </html>
  );
}
