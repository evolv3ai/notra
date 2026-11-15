import { HydrationBoundary } from "@tanstack/react-query";
import { type AnyRoute, redirect } from "@tanstack/react-router";

import ReadinessLoading from "@/app/(dashboard)/[slug]/geo/agent-readiness/loading";
import { GeoCompetitorsSkeleton as CompetitorsLoading } from "@/app/(dashboard)/[slug]/geo/competitors/skeleton";
import GapsLoading from "@/app/(dashboard)/[slug]/geo/gaps/loading";
import PersonasLoading from "@/app/(dashboard)/[slug]/geo/personas/loading";
import PromptsLoading from "@/app/(dashboard)/[slug]/geo/prompts/loading";
import ShelfLoading from "@/app/(dashboard)/[slug]/geo/shelf-space/loading";
import { GeoPageSkeleton } from "@/app/(dashboard)/[slug]/geo/skeleton";
import TrafficLoading from "@/app/(dashboard)/[slug]/geo/traffic/loading";
import { geoCompetitorDetailPath } from "@/utils/geo-competitors";
import { withGeoProject } from "@/utils/geo-paths";
import { lazyPage } from "@/utils/lazy-page";
import { geoSettingsPath } from "@/utils/settings-path";

import { gateGeoPage, loadGeoPage } from "./-dashboard-loaders";
import { createUiRoute } from "./-ui-route";

const Overview = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/page-client")
);
const Traffic = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/traffic/page-client")
);
const McpTraffic = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/traffic/mcp/page-client")
);
const Competitors = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/competitors/page-client")
);
const Readiness = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/agent-readiness/page-client")
);
const Directions = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/directions/page-client")
);
const Gaps = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/gaps/page-client")
);
const Personas = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/personas/page-client")
);
const Prompts = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/prompts/page-client")
);
const Shelf = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/shelf-space/page-client")
);

export function createGeoUiRoutes(parent: AnyRoute) {
  return [
    createUiRoute({
      parent,
      path: "/",
      title: { namespace: "common", key: "labels.geo" },
      pendingComponent: GeoPageSkeleton,
      loaderSearchKeys: ["project", "range"],
      loader: (input) => loadGeoPage({ data: { ...input, kind: "overview" } }),
      gate: (input) => gateGeoPage({ data: { ...input, kind: "overview" } }),
      stream: "ssr",
      preload: Overview.preload,
      component: ({ data, params }) => (
        <HydrationBoundary state={data.state}>
          <Overview organizationSlug={params.slug} />
        </HydrationBoundary>
      ),
    }),
    createUiRoute({
      parent,
      path: "traffic",
      title: { namespace: "geo.pages.traffic", key: "metaTitle" },
      pendingComponent: TrafficLoading,
      // The page's hooks refetch on project, range and host changes; rerunning
      // the server prefetch as well would query Tinybird twice.
      loaderSearchKeys: [],
      loader: (input) => loadGeoPage({ data: { ...input, kind: "traffic" } }),
      gate: (input) => gateGeoPage({ data: { ...input, kind: "traffic" } }),
      stream: "ssr",
      preload: Traffic.preload,
      component: ({ data, params }) => (
        <HydrationBoundary state={data.state}>
          <Traffic layout={data.trafficLayout} organizationSlug={params.slug} />
        </HydrationBoundary>
      ),
    }),
    createUiRoute({
      parent,
      path: "traffic/mcp",
      title: { namespace: "geo.pages.traffic", key: "mcpMetaTitle" },
      preload: McpTraffic.preload,
      component: ({ params }) => <McpTraffic organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "competitors",
      title: { namespace: "geo.pages.competitors", key: "metaTitle" },
      pendingComponent: CompetitorsLoading,
      preload: Competitors.preload,
      component: ({ params }) => <Competitors organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "competitors/$competitor",
      title: { namespace: "geo.shared", key: "competitor" },
      component: () => null,
      loader: async ({ params, searchParams }) => {
        throw redirect({
          href: withGeoProject(
            geoCompetitorDetailPath(params.slug ?? "", params.competitor ?? ""),
            typeof searchParams.project === "string"
              ? searchParams.project
              : undefined
          ),
        });
      },
    }),
    createUiRoute({
      parent,
      path: "agent-readiness",
      title: { namespace: "common", key: "labels.agentReadiness" },
      pendingComponent: ReadinessLoading,
      preload: Readiness.preload,
      component: ({ params }) => <Readiness organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "directions",
      title: { namespace: "geo.shared", key: "geoDirections" },
      pendingComponent: GeoPageSkeleton,
      preload: Directions.preload,
      component: () => <Directions />,
    }),
    createUiRoute({
      parent,
      path: "gaps",
      title: { namespace: "geo.pages.gaps", key: "metaTitle" },
      pendingComponent: GapsLoading,
      preload: Gaps.preload,
      component: ({ params }) => <Gaps organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "personas",
      title: { namespace: "geo.pages.personas", key: "metaTitle" },
      pendingComponent: PersonasLoading,
      preload: Personas.preload,
      component: ({ params }) => <Personas organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "prompts",
      title: { namespace: "geo.pages.prompts", key: "metaTitle" },
      pendingComponent: PromptsLoading,
      preload: Prompts.preload,
      component: ({ params }) => <Prompts organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "shelf-space",
      title: { namespace: "geo.pages.shelfSpace", key: "metaTitle" },
      pendingComponent: ShelfLoading,
      preload: Shelf.preload,
      component: ({ params }) => <Shelf organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "write",
      title: { namespace: "common", key: "labels.content" },
      component: () => null,
      loader: ({ params, searchParams }) => {
        throw redirect({
          href: withGeoProject(
            `/${params.slug ?? ""}/content`,
            typeof searchParams.project === "string"
              ? searchParams.project
              : undefined
          ),
        });
      },
    }),
    createUiRoute({
      parent,
      path: "settings",
      title: { namespace: "common", key: "labels.geoSettings" },
      component: () => null,
      loader: async ({ params, searchParams }) => {
        throw redirect({
          href: geoSettingsPath(params.slug ?? "", {
            project:
              typeof searchParams.project === "string"
                ? searchParams.project
                : undefined,
          }),
        });
      },
    }),
  ];
}
