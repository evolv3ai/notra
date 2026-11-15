import { FlagsProvider } from "@databuddy/sdk/react";
import { Toaster } from "@notra/ui/components/ui/sonner";
import {
  createRootRoute,
  HeadContent,
  lazyRouteComponent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DevTools } from "c15t/react/devtools";
import {
  ConsentBanner,
  ConsentDialog,
  ConsentRoot,
  ConsentTheme,
  local,
} from "c15t/tanstack-start";
import {
  consentLoaderOptions,
  createConsentStateHandler,
} from "c15t/tanstack-start/server";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { ReactNode } from "react";

import { AppLinkTracking } from "@/components/app-link-tracking";
import { ThemeProvider } from "@/components/theme-provider";
import { consentScripts } from "@/consent-scripts";
import { DUB_CLEAR_ON_REVOCATION } from "@/constants/dub";
import interCore from "@/fonts/subsets/inter-core.woff2?url";
import { consentComponents, consentTheme } from "@/lib/consent-manager/theme";
import { RSS_FEED_PATH, RSS_FEED_TITLE } from "@/utils/constants";
import { buildNavbarSessionScript } from "@/utils/navbar-session";

import globalsCss from "@/styles/globals.css?url";

const databuddyClientId = import.meta.env.NEXT_PUBLIC_DATABUDDY_WEB_WEBSITE_ID;

const getConsentState = createServerFn({ method: "GET" }).handler(
  createConsentStateHandler({ proxy: true, routePrefix: "/api/c15t" })
);

export const Route = createRootRoute({
  ...consentLoaderOptions,
  loader: async () => ({ consent: await getConsentState() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "apple-mobile-web-app-title", content: "Notra" },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      {
        rel: "preload",
        href: interCore,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "120x120",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        rel: "alternate",
        href: RSS_FEED_PATH,
        title: RSS_FEED_TITLE,
        type: "application/rss+xml",
      },
    ],
    scripts: [
      {
        id: "navbar-session-prefetch",
        children: buildNavbarSessionScript(),
      },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
  notFoundComponent: lazyRouteComponent(
    () => import("@/components/not-found-page")
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  const { consent } = Route.useLoaderData();
  return (
    <html
      lang="en"
      style={{ scrollbarGutter: "stable" }}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
        <meta
          content="#f7f5f3"
          media="(prefers-color-scheme: light)"
          name="theme-color"
        />
        <meta
          content="#1f1a17"
          media="(prefers-color-scheme: dark)"
          name="theme-color"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <ConsentTheme theme={consentTheme} />
          <ConsentRoot
            state={consent}
            clearOnRevocation={DUB_CLEAR_ON_REVOCATION}
            scripts={consentScripts}
            options={{
              consentCategories: ["necessary", "measurement", "marketing"],
              theme: consentTheme,
              components: consentComponents,
              ...(process.env.NODE_ENV !== "production"
                ? { mode: local() }
                : {}),
            }}
          >
            <ConsentBanner />
            <ConsentDialog />
            {process.env.NODE_ENV !== "production" && <DevTools />}
            <FlagsProvider
              clientId={databuddyClientId ?? ""}
              disabled={!databuddyClientId}
            >
              <NuqsAdapter>{children}</NuqsAdapter>
            </FlagsProvider>
          </ConsentRoot>
          <AppLinkTracking />
          <Toaster position="bottom-right" />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
