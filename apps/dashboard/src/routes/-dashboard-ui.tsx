import { HydrationBoundary } from "@tanstack/react-query";
import {
  type AnyRoute,
  createRoute,
  Outlet,
  redirect,
  type Router,
} from "@tanstack/react-router";
import { Suspense, useEffect } from "react";

import AutomationsLoading from "@/app/(dashboard)/[slug]/automation/loading";
import BrandLoading from "@/app/(dashboard)/[slug]/brand/identity/loading";
import ChatLoading from "@/app/(dashboard)/[slug]/chat/loading";
import NewChatLoading from "@/app/(dashboard)/[slug]/chat/new-loading";
import CollectionLoading from "@/app/(dashboard)/[slug]/collection/[id]/loading";
import ContentDetailLoading from "@/app/(dashboard)/[slug]/content/[id]/loading";
import ContentLoading from "@/app/(dashboard)/[slug]/content/loading";
import FeedbackLoading from "@/app/(dashboard)/[slug]/feedback/loading";
import DashboardLoading from "@/app/(dashboard)/[slug]/loading";
import SkillDetailLoading from "@/app/(dashboard)/[slug]/skills/[name]/loading";
import SkillsLoading from "@/app/(dashboard)/[slug]/skills/loading";
import { AnalyticsProvider } from "@/components/analytics/analytics-context";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";
import { DashboardClientWrapper } from "@/components/dashboard/dashboard-client-wrapper";
import { GeoCompetitorSheetHost } from "@/components/geo/competitor-sheet-host";
import { GeoCatalogWarmer } from "@/components/geo/geo-catalog-warmer";
import { GeoPageGate } from "@/components/geo/geo-page-gate";
import { IntegrationsBackLink } from "@/components/integrations/integrations-back-link";
import { GeoLiveProvider } from "@/components/providers/geo-live-provider";
import { GeoProjectQueryProvider } from "@/components/providers/geo-project-provider";
import { LOGS_SETTINGS_SEARCH_KEYS } from "@/constants/settings";
import { lazyPage } from "@/utils/lazy-page";
import {
  firstSearchParamValue,
  settingsPath,
  settingsQueryFromSearchParams,
} from "@/utils/settings-path";

import { createAnalyticsUiRoutes } from "./-analytics-ui";
import {
  gateDashboardHome,
  loadDashboardHome,
  loadGeoScope,
  loadOrganizationPage,
  loadOrganizationShell,
} from "./-dashboard-loaders";
import { createGeoUiRoutes } from "./-geo-ui";
import { createIntegrationUiRoutes } from "./-integrations-ui";
import { createSitesUiRoutes } from "./-sites-ui";
import { UiModalProvider } from "./-ui-modal";
import { createUiRoute, uiRouteSearch } from "./-ui-route";

const Home = lazyPage(() => import("@/app/(dashboard)/[slug]/page-client"));
const StudioFreeHome = lazyPage(() =>
  import("@/components/dashboard/studio-free-home").then((module) => ({
    default: module.StudioFreeHome,
  }))
);
const Content = lazyPage(
  () => import("@/app/(dashboard)/[slug]/content/page-client")
);
const ContentDetail = lazyPage(
  () => import("@/app/(dashboard)/[slug]/content/[id]/page-client")
);
const Collection = lazyPage(
  () => import("@/app/(dashboard)/[slug]/collection/[id]/page-client")
);
const Skills = lazyPage(
  () => import("@/app/(dashboard)/[slug]/skills/page-client")
);
const SkillDetail = lazyPage(
  () => import("@/app/(dashboard)/[slug]/skills/[name]/page-client")
);
const Chat = lazyPage(() =>
  Promise.all([
    import("@/app/(dashboard)/[slug]/chat/page-client"),
    import("@/components/dashboard/chat-history-nav"),
  ]).then(([page]) => page)
);
const ApiKeys = lazyPage(
  () => import("@/app/(dashboard)/[slug]/api-keys/page")
);
const Automations = lazyPage(
  () => import("@/app/(dashboard)/[slug]/automation/page-client")
);
const AutomationTemplates = lazyPage(
  () => import("@/app/(dashboard)/[slug]/automation/templates/page-client")
);
const AutomationRuns = lazyPage(
  () => import("@/app/(dashboard)/[slug]/automation/runs/page-client")
);
const AutomationEditor = lazyPage(
  () => import("@/app/(dashboard)/[slug]/automation/editor/page-client")
);
const Brand = lazyPage(
  () => import("@/app/(dashboard)/[slug]/brand/identity/page-client")
);
const Feedback = lazyPage(
  () => import("@/app/(dashboard)/[slug]/feedback/page-client")
);
const Autopilot = lazyPage(
  () => import("@/app/(dashboard)/[slug]/autopilot/page-client")
);
const AutopilotRun = lazyPage(
  () => import("@/app/(dashboard)/[slug]/autopilot/runs/[id]/page-client")
);
const AutopilotFinding = lazyPage(
  () => import("@/app/(dashboard)/[slug]/autopilot/findings/[id]/page-client")
);
const AutopilotAutomation = lazyPage(
  () => import("@/app/(dashboard)/[slug]/autopilot/[automation]/page-client")
);
const BillingSuccess = lazyPage(
  () => import("@/app/(dashboard)/[slug]/settings/billing/success/page")
);

type OrganizationShell = Awaited<ReturnType<typeof loadOrganizationShell>>;

let clientShellCache: { slug: string; shell: OrganizationShell } | undefined;

export function createDashboardUiRoutes(parent: AnyRoute) {
  function OrganizationLayout() {
    const { organizationShell } =
      organization.useRouteContext<Router<typeof organization>>();
    useEffect(() => {
      clientShellCache = {
        slug: organizationShell.initialActiveOrganization.slug,
        shell: organizationShell,
      };
    }, [organizationShell]);
    const { state, ...shell } = organizationShell;
    return (
      <HydrationBoundary state={state}>
        <DashboardClientWrapper {...shell}>
          <Suspense fallback={<DashboardLoading />}>
            <Outlet />
          </Suspense>
        </DashboardClientWrapper>
      </HydrationBoundary>
    );
  }

  function AnalyticsLayout() {
    const { slug } = organization.useParams<Router<typeof organization>>();
    return (
      <AnalyticsProvider organizationSlug={slug}>
        <AnalyticsShell>
          <UiModalProvider>
            <Outlet />
          </UiModalProvider>
        </AnalyticsShell>
      </AnalyticsProvider>
    );
  }

  function GeoLayout() {
    const { slug } = organization.useParams<Router<typeof organization>>();
    const { organizationShell } =
      organization.useRouteContext<Router<typeof organization>>();
    const { projectId, geoAccess } = geo.useLoaderData<Router<typeof geo>>();
    return (
      <>
        <GeoCatalogWarmer organizationSlug={slug} />
        <GeoProjectQueryProvider initialProjectId={projectId} key={slug}>
          <GeoLiveProvider
            organizationId={organizationShell.initialActiveOrganization.id}
          >
            <GeoPageGate
              fallback={<DashboardLoading />}
              initialAccess={geoAccess}
            >
              <UiModalProvider>
                <Outlet />
                <GeoCompetitorSheetHost organizationSlug={slug} />
              </UiModalProvider>
            </GeoPageGate>
          </GeoLiveProvider>
        </GeoProjectQueryProvider>
      </>
    );
  }

  const organization = createRoute({
    getParentRoute: () => parent,
    path: "$slug",
    validateSearch: uiRouteSearch,
    beforeLoad: async ({ params, search, cause }) => {
      const cached = clientShellCache;
      if (cause !== "enter" && cached?.slug === params.slug) {
        return { organizationShell: cached.shell };
      }
      const shell = await loadOrganizationShell({
        data: { params, searchParams: search },
      });
      if (typeof window !== "undefined") {
        clientShellCache = { slug: params.slug, shell };
      }
      return { organizationShell: shell };
    },
    pendingComponent: DashboardLoading,
    component: OrganizationLayout,
  });

  const analytics = createRoute({
    getParentRoute: () => organization,
    path: "analytics",
    component: AnalyticsLayout,
  });

  const geo = createRoute({
    getParentRoute: () => organization,
    path: "geo",
    loader: ({ params }) =>
      loadGeoScope({ data: { params, searchParams: {} } }),
    component: GeoLayout,
  });

  const integrations = createRoute({
    getParentRoute: () => organization,
    path: "integrations",
    component: () => (
      <>
        <IntegrationsBackLink />
        <UiModalProvider>
          <Outlet />
        </UiModalProvider>
      </>
    ),
  });

  const routes = [
    createUiRoute({
      parent: organization,
      path: "/",
      title: { namespace: "dashboard", key: "metaTitle" },
      loaderSearchKeys: ["project"],
      loader: (input) => loadDashboardHome({ data: input }),
      gate: (input) => gateDashboardHome({ data: input }),
      stream: true,
      pendingComponent: DashboardLoading,
      // Free plans render StudioFreeHome inside the same streamed Suspense
      // fallback, so start its chunk without making paid plans wait for it.
      preload: () => {
        void StudioFreeHome.preload().catch(() => undefined);
        return Home.preload();
      },
      component: ({ params, data }) =>
        data.hasAccess ? (
          <HydrationBoundary state={data.state}>
            <Home
              greetingText={data.greetingText}
              organizationSlug={params.slug}
            />
          </HydrationBoundary>
        ) : (
          <StudioFreeHome greetingText={data.greetingText} slug={params.slug} />
        ),
    }),
    createUiRoute({
      parent: organization,
      path: "content",
      title: { namespace: "common", key: "labels.content" },
      loaderSearchKeys: ["project", "page"],
      loader: (input) =>
        loadOrganizationPage({ data: { ...input, kind: "content" } }),
      stream: true,
      pendingComponent: ContentLoading,
      preload: Content.preload,
      component: ({ params, data }) => (
        <HydrationBoundary state={data.state}>
          <Content
            articleAvailable={data.articleAvailable}
            initialProjectId={data.projectId ?? null}
            organizationSlug={params.slug}
          />
        </HydrationBoundary>
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "content/$id",
      title: {
        namespace: "content.detail",
        key: "metaTitle",
        descriptionKey: "metaDescription",
      },
      loaderSearchKeys: ["project", "page"],
      loader: (input) =>
        loadOrganizationPage({ data: { ...input, kind: "content-detail" } }),
      stream: true,
      pendingComponent: ContentDetailLoading,
      preload: ContentDetail.preload,
      component: ({ params, data }) => (
        <HydrationBoundary state={data.state}>
          <ContentDetail
            contentId={params.id}
            key={`${data.organizationId}:${params.id}`}
            organizationId={data.organizationId}
            organizationSlug={params.slug}
          />
        </HydrationBoundary>
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "collection/$id",
      title: {
        namespace: "content.collections.detail",
        key: "metaTitle",
        descriptionKey: "metaDescription",
      },
      loaderSearchKeys: ["project", "page"],
      loader: (input) =>
        loadOrganizationPage({ data: { ...input, kind: "collection" } }),
      pendingComponent: CollectionLoading,
      preload: Collection.preload,
      component: ({ params, data }) => (
        <Collection
          collectionId={params.id}
          organizationId={data.organizationId}
          organizationSlug={params.slug}
        />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "skills",
      title: { namespace: "common", key: "labels.skills" },
      loaderSearchKeys: ["project", "page"],
      loader: (input) =>
        loadOrganizationPage({ data: { ...input, kind: "skills" } }),
      stream: true,
      pendingComponent: SkillsLoading,
      preload: Skills.preload,
      component: ({ params, data }) => (
        <HydrationBoundary state={data.state}>
          <Skills organizationId={data.organizationId} slug={params.slug} />
        </HydrationBoundary>
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "skills/$name",
      title: { namespace: "skills.detail", key: "metaTitle" },
      loaderSearchKeys: ["project", "page"],
      loader: (input) =>
        loadOrganizationPage({ data: { ...input, kind: "skill-detail" } }),
      stream: true,
      pendingComponent: SkillDetailLoading,
      preload: SkillDetail.preload,
      component: ({ params, data }) => (
        <HydrationBoundary state={data.state}>
          <SkillDetail
            key={`${data.organizationId}:${params.name}`}
            name={params.name}
            organizationId={data.organizationId}
            slug={params.slug}
          />
        </HydrationBoundary>
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "chat",
      title: { title: "Chat" },
      pendingComponent: NewChatLoading,
      preload: Chat.preload,
      component: ({ params }) => <Chat organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent: organization,
      path: "chat/$chatId",
      title: { title: "Chat" },
      pendingComponent: ChatLoading,
      preload: Chat.preload,
      component: ({ params }) => (
        <Chat
          chatId={params.chatId}
          key={params.chatId}
          organizationSlug={params.slug}
        />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "api-keys",
      preload: ApiKeys.preload,
      component: () => <ApiKeys />,
    }),
    createUiRoute({
      parent: organization,
      path: "automation",
      title: { namespace: "automation", key: "metaTitle" },
      pendingComponent: AutomationsLoading,
      preload: Automations.preload,
      component: ({ params }) => <Automations organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent: organization,
      path: "automation/templates",
      title: { namespace: "automation", key: "templatesMetaTitle" },
      preload: AutomationTemplates.preload,
      component: ({ params }) => (
        <AutomationTemplates organizationSlug={params.slug} />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "automation/runs",
      title: { namespace: "automation", key: "runsMetaTitle" },
      preload: AutomationRuns.preload,
      component: ({ params }) => (
        <AutomationRuns organizationSlug={params.slug} />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "automation/new",
      title: { namespace: "automation", key: "editorMetaTitle" },
      preload: AutomationEditor.preload,
      component: ({ params }) => (
        <AutomationEditor organizationSlug={params.slug} />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "automation/$id",
      title: { namespace: "automation", key: "editorMetaTitle" },
      preload: AutomationEditor.preload,
      component: ({ params }) => (
        <AutomationEditor
          key={params.id}
          organizationSlug={params.slug}
          triggerId={params.id}
        />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "brand/identity",
      title: { namespace: "common", key: "labels.brandIdentity" },
      pendingComponent: BrandLoading,
      preload: Brand.preload,
      component: ({ params }) => <Brand organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent: organization,
      path: "feedback",
      title: { namespace: "common", key: "labels.feedback" },
      pendingComponent: FeedbackLoading,
      preload: Feedback.preload,
      component: ({ params }) => <Feedback organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent: organization,
      path: "autopilot",
      title: { title: "Autopilot" },
      preload: Autopilot.preload,
      component: ({ params }) => <Autopilot organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent: organization,
      path: "autopilot/runs/$id",
      title: { title: "Autopilot run" },
      preload: AutopilotRun.preload,
      component: ({ params }) => (
        <AutopilotRun organizationSlug={params.slug} runId={params.id} />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "autopilot/findings/$id",
      title: { title: "Autopilot" },
      preload: AutopilotFinding.preload,
      component: ({ params }) => (
        <AutopilotFinding
          findingId={params.id}
          organizationSlug={params.slug}
        />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "autopilot/$name",
      title: { title: "Autopilot" },
      preload: AutopilotAutomation.preload,
      component: ({ params }) => (
        <AutopilotAutomation
          automation={params.name}
          organizationSlug={params.slug}
        />
      ),
    }),
    createUiRoute({
      parent: organization,
      path: "settings/billing/success",
      preload: BillingSuccess.preload,
      component: () => <BillingSuccess />,
    }),
    ...(
      [
        "account",
        "appearance",
        "attachments",
        "billing",
        "credits",
        "general",
        "logs",
        "members",
        "notifications",
        "usage",
        "usage-alerts",
      ] as const
    ).map((section) =>
      createUiRoute({
        parent: organization,
        path: `settings/${section}`,
        component: () => null,
        loader: async ({ params, searchParams }) => {
          let extras: Record<string, string | undefined> | undefined;
          if (section === "logs") {
            extras = settingsQueryFromSearchParams(
              searchParams,
              LOGS_SETTINGS_SEARCH_KEYS
            );
          } else if (section === "credits" && searchParams.success === "true") {
            extras = { success: "true" };
          }
          const target =
            section === "billing" &&
            firstSearchParamValue(searchParams.tab) === "usage"
              ? "usage"
              : section;
          throw redirect({
            href: settingsPath(params.slug ?? "", target, extras),
          });
        },
      })
    ),
    createUiRoute({
      parent: organization,
      path: "settings/billing/usage",
      component: () => null,
      loader: async ({ params }) => {
        throw redirect({ href: settingsPath(params.slug ?? "", "usage") });
      },
    }),
    createUiRoute({
      parent: organization,
      path: "settings",
      component: () => null,
      loader: async ({ params }) => {
        throw redirect({ href: settingsPath(params.slug ?? "", "general") });
      },
    }),
    ...(
      [
        "schedules",
        "automation/schedule",
        "automation/schedules",
        "automation/events",
      ] as const
    ).map((path) =>
      createUiRoute({
        parent: organization,
        path,
        component: () => null,
        loader: async ({ params }) => {
          throw redirect({
            href: `/${params.slug}/automation`,
            statusCode: 308,
          });
        },
      })
    ),
    createUiRoute({
      parent: organization,
      path: "logs",
      component: () => null,
      loader: async ({ params }) => {
        throw redirect({ href: settingsPath(params.slug ?? "", "logs") });
      },
    }),
    analytics.addChildren(createAnalyticsUiRoutes(analytics)),
    geo.addChildren(createGeoUiRoutes(geo)),
    integrations.addChildren(createIntegrationUiRoutes(integrations)),
    ...createSitesUiRoutes(organization),
  ];

  return [organization.addChildren(routes)];
}
