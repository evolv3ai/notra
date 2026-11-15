import { describe, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import de from "../messages/de.json";
import en from "../messages/en.json";
import type { SiteDomain } from "../src/types/sites";

if (!process.env.NOTRA_SITE_OVERVIEW_NAVIGATION_WORKER) {
  test("overview keeps domain management and deployment history reachable", () => {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        cwd: fileURLToPath(new URL("../../..", import.meta.url)),
        env: { ...process.env, NOTRA_SITE_OVERVIEW_NAVIGATION_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  });
} else {
  mock.module("../src/components/sites/site-context", () => ({
    useSite: () => ({
      organizationId: "org",
      organizationSlug: "acme",
      siteId: "site",
      liveDeployment: null,
      detail: {
        site: {
          name: "Acme",
          status: "active",
          liveUrl: "https://acme.example/blog",
          productionBranch: "main",
          projectId: "project",
        },
        deployments: [],
        previews: [],
      },
    }),
  }));
  mock.module("../src/components/framework/link", () => ({
    default: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
  }));
  mock.module("../src/lib/hooks/use-site-deployments", () => ({
    useDeployLatest: () => ({ isPending: false, mutate: () => undefined }),
  }));
  mock.module("../src/lib/hooks/use-sites", () => ({
    useInvalidateSites: () => () => undefined,
    useSitePlanLimitReached: () => false,
  }));
  mock.module("../src/components/sites/site-overview-hero", () => ({
    SiteOverviewHero: () => null,
  }));
  mock.module("../src/components/sites/site-deployments-table", () => ({
    SiteDeploymentsTable: () => null,
  }));
  mock.module("../src/components/sites/site-previews-table", () => ({
    SitePreviewsTable: () => null,
  }));
  mock.module("../src/components/sites/site-visitors-card", () => ({
    SiteVisitorsCard: () => null,
  }));
  const { SiteOverviewDomains } =
    await import("../src/components/sites/site-overview-domains");
  const { SiteOverviewPage } =
    await import("../src/components/sites/pages/site-overview-page");

  describe.each([
    ["en", en],
    ["de", de],
  ] as const)("%s overview navigation", (locale, messages) => {
    const render = (children: ReactNode) =>
      renderToStaticMarkup(
        <IntlProvider locale={locale} messages={messages} timeZone="UTC">
          {children}
        </IntlProvider>
      );

    test.each([false, true])(
      "domain management is reachable with custom domains: %s",
      (custom) => {
        const domains = custom
          ? ([
              {
                id: "domain",
                hostname: "acme.example",
                isPrimary: true,
                status: "active",
              },
            ] as SiteDomain[])
          : [];
        const html = render(
          <SiteOverviewDomains
            aliasUrl="https://acme.notra.site/blog"
            domains={domains}
          />
        );
        expect(html).toContain('href="/acme/sites/site/domains"');
        expect(html).toContain(
          messages.sites.overviewPage[
            custom ? "manageDomains" : "addCustomDomain"
          ]
        );
        if (custom) {
          expect(html).toContain('href="https://acme.example/blog"');
        }
      }
    );

    test("deployment history remains reachable without deployments or previews", () => {
      const html = render(<SiteOverviewPage />);
      expect(html).toContain('href="/acme/sites/site/deployments"');
      expect(html).toContain(messages.sites.list.viewDeployments);
    });
  });
}
