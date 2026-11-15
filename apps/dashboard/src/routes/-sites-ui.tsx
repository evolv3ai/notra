import { isDemoModeClient } from "@notra/utils/demo-mode";
import { HydrationBoundary } from "@tanstack/react-query";
import {
  type AnyRoute,
  createRoute,
  notFound,
  Outlet,
  redirect,
  type Router,
} from "@tanstack/react-router";

import { NewSitePageSkeleton as NewSiteLoading } from "@/app/(dashboard)/[slug]/sites/new/skeleton";
import { SitesPageSkeleton as SitesLoading } from "@/app/(dashboard)/[slug]/sites/skeleton";
import { SitesLiveProvider } from "@/components/providers/sites-live-provider";
import {
  SiteSectionSkeleton as SiteSectionLoading,
  SiteDeploymentSkeleton as SiteDeploymentLoading,
} from "@/components/sites/site-page-skeleton";
import { SitePageSkeleton as SiteLoading } from "@/components/sites/site-route-skeleton";
import { SITE_SECTION_PAGES } from "@/constants/site-ui-pages";
import type { UiRouteMatch } from "@/types/ui-route";
import { lazyPage } from "@/utils/lazy-page";
import { siteHref, sitePreviewDeploymentsHref } from "@/utils/site-links";

import { loadSite, loadSiteName } from "./-sites-loaders";
import { createUiRoute, uiRouteSearch } from "./-ui-route";

const SiteLayout = lazyPage(() =>
  import("@/components/sites/site-layout").then((module) => ({
    default: module.SiteLayout,
  }))
);
const Sites = lazyPage(
  () => import("@/app/(dashboard)/[slug]/sites/page-client")
);
const NewSite = lazyPage(
  () => import("@/app/(dashboard)/[slug]/sites/new/page-client")
);
const Overview = lazyPage(() =>
  import("@/components/sites/pages/site-overview-page").then((module) => ({
    default: module.SiteOverviewPage,
  }))
);
const DeploymentDetail = lazyPage(() =>
  import("@/components/sites/pages/site-deployment-detail-page").then(
    (module) => ({ default: module.SiteDeploymentDetailPage })
  )
);

export function createSitesUiRoutes(organization: AnyRoute) {
  function SitesRouteLayout() {
    const { slug } = organization.useParams();
    return (
      <SitesLiveProvider organizationSlug={slug}>
        <Outlet />
      </SitesLiveProvider>
    );
  }

  const sites = createRoute({
    getParentRoute: () => organization,
    path: "sites",
    beforeLoad: () => {
      if (isDemoModeClient()) {
        throw notFound();
      }
    },
    component: SitesRouteLayout,
  });
  function SiteRouteLayout() {
    const { slug, siteId } = site.useParams();
    const { state } = site.useLoaderData<Router<typeof site>>();
    return (
      <HydrationBoundary state={state}>
        <SiteLayout organizationSlug={slug} siteId={siteId}>
          <Outlet />
        </SiteLayout>
      </HydrationBoundary>
    );
  }
  SiteRouteLayout.preload = SiteLayout.preload;

  const site = createRoute({
    getParentRoute: () => sites,
    path: "$siteId",
    // Queries keep the site fresh once it renders; the loader only seeds them,
    // so tab clicks inside the site don't run it again. The first document
    // skips it: waiting on R2 there delays the whole page, while the client
    // fetches the same queries right after hydration.
    loaderDeps: ({ search }) => ({
      branch: uiRouteSearch(search as Record<string, unknown>).branch,
    }),
    shouldReload: ({ cause }) => (cause === "stay" ? false : undefined),
    loader: async ({ params, deps }) =>
      import.meta.env.SSR
        ? {
            state: undefined,
            name: await loadSiteName({
              data: { params, searchParams: {} },
            }).catch(() => null),
          }
        : loadSite({ data: { params, searchParams: deps } }),
    pendingComponent: SiteLoading,
    component: SiteRouteLayout,
  });
  const siteName = (matches: readonly UiRouteMatch[]) => {
    const data = matches.find((match) => match.routeId === site.id)
      ?.loaderData as { name?: string | null } | undefined;
    return data?.name;
  };

  const siteRoutes = [
    createRoute({
      getParentRoute: () => site,
      path: "integrations",
      beforeLoad: ({ params, search }) => {
        // Keeps project, branch and Inth OAuth results from older links and in-flight sign-ins.
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(search)) {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            query.set(key, String(value));
          }
        }
        query.set("section", "integrations");
        throw redirect({
          href: `${siteHref(params.slug, params.siteId, "design")}?${query}`,
          replace: true,
        });
      },
    }),
    createRoute({
      getParentRoute: () => site,
      path: "editor",
      beforeLoad: ({ params, search }) => {
        const query = new URLSearchParams();
        if (typeof search.project === "string") {
          query.set("project", search.project);
        }
        if (typeof search.branch === "string") {
          query.set("branch", search.branch);
        }
        throw redirect({
          href: `${siteHref(params.slug, params.siteId)}${query.size ? `?${query}` : ""}`,
          replace: true,
        });
      },
    }),
    createRoute({
      getParentRoute: () => site,
      path: "previews",
      beforeLoad: ({ params }) => {
        throw redirect({
          href: sitePreviewDeploymentsHref(params.slug, params.siteId),
          replace: true,
        });
      },
    }),
    createUiRoute({
      parent: site,
      path: "/",
      title: { namespace: "sites.detail.tabs", key: "overview" },
      titleSuffix: siteName,
      pendingComponent: SiteSectionLoading,
      preload: Overview.preload,
      component: () => <Overview />,
    }),
    ...SITE_SECTION_PAGES.map(({ section, page: Page, skeleton }) =>
      createUiRoute({
        parent: site,
        path: section,
        title: { namespace: "sites.detail.tabs", key: section },
        titleSuffix: siteName,
        pendingComponent: skeleton ?? SiteSectionLoading,
        preload: Page.preload,
        component: () => <Page />,
      })
    ),
    createUiRoute({
      parent: site,
      path: "deployments/$deploymentId",
      title: { namespace: "sites.deploymentPage", key: "title" },
      titleSuffix: siteName,
      pendingComponent: SiteDeploymentLoading,
      preload: DeploymentDetail.preload,
      component: ({ params }) => (
        <DeploymentDetail deploymentId={params.deploymentId} />
      ),
    }),
  ];

  return [
    sites.addChildren([
      createUiRoute({
        parent: sites,
        path: "/",
        title: { namespace: "sites", key: "title" },
        pendingComponent: SitesLoading,
        preload: Sites.preload,
        component: ({ params, searchParams }) => (
          <Sites
            organizationSlug={params.slug}
            showAll={searchParams.view === "all"}
          />
        ),
      }),
      createUiRoute({
        parent: sites,
        path: "new",
        title: { namespace: "sites.new", key: "title" },
        pendingComponent: NewSiteLoading,
        preload: NewSite.preload,
        component: ({ params }) => (
          <NewSite key={params.slug} organizationSlug={params.slug} />
        ),
      }),
      site.addChildren(siteRoutes),
    ]),
  ];
}
