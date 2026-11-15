import {
  type AnyRoute,
  createRoute,
  Outlet,
  type Router,
} from "@tanstack/react-router";
import { Suspense } from "react";

import OnboardingLayout from "@/app/onboarding/layout";
import { OnboardingSplitLayout } from "@/components/onboarding/split-layout";
import { OnboardingSplitLayoutContext } from "@/components/onboarding/split-layout-context";
import { ONBOARDING_STEPS } from "@/constants/analytics-events";
import { setOnboardingVariant } from "@/lib/analytics/onboarding-funnel";
import { lazyPage } from "@/utils/lazy-page";

import {
  loadOnboardingCompetitors,
  loadOnboardingConnect,
  loadOnboardingEntry,
  loadOnboardingLayout,
  loadOnboardingVisibility,
  loadOnboardingWorkspace,
} from "./-onboarding-loaders";
import { createUiRoute } from "./-ui-route";

const Workspace = lazyPage(() =>
  import("@/app/onboarding/workspace/workspace-form").then((module) => ({
    default: module.WorkspaceForm,
  }))
);
const Visibility = lazyPage(() =>
  import("@/app/onboarding/visibility/visibility-form").then((module) => ({
    default: module.VisibilityForm,
  }))
);
const Connect = lazyPage(() =>
  import("@/app/onboarding/connect/connect-step").then((module) => ({
    default: module.ConnectStep,
  }))
);
const Competitors = lazyPage(() =>
  import("@/app/onboarding/competitors/competitors-form").then((module) => ({
    default: module.CompetitorsForm,
  }))
);

export function createOnboardingUiRoutes(parent: AnyRoute) {
  function OnboardingRouteLayout() {
    const context = onboarding.useLoaderData<Router<typeof onboarding>>();
    setOnboardingVariant(context.onboardingVariant);
    return (
      <OnboardingSplitLayoutContext value={context}>
        <OnboardingLayout>
          <Suspense>
            <Outlet />
          </Suspense>
        </OnboardingLayout>
      </OnboardingSplitLayoutContext>
    );
  }

  const onboarding = createRoute({
    getParentRoute: () => parent,
    path: "onboarding",
    loader: () => loadOnboardingLayout(),
    component: OnboardingRouteLayout,
  });
  return [
    onboarding.addChildren([
      createUiRoute({
        parent: onboarding,
        path: "/",
        component: () => null,
        loader: (input) => loadOnboardingEntry({ data: input }),
      }),
      createUiRoute({
        parent: onboarding,
        path: "workspace",
        loader: (input) => loadOnboardingWorkspace({ data: input }),
        preload: Workspace.preload,
        component: ({ data }) => (
          <OnboardingSplitLayout step={ONBOARDING_STEPS.WORKSPACE}>
            <Workspace {...data} />
          </OnboardingSplitLayout>
        ),
      }),
      createUiRoute({
        parent: onboarding,
        path: "visibility",
        title: { namespace: "onboarding.visibility", key: "metaTitle" },
        loader: (input) => loadOnboardingVisibility({ data: input }),
        preload: Visibility.preload,
        component: ({ data }) => (
          <OnboardingSplitLayout step={ONBOARDING_STEPS.VISIBILITY}>
            <Visibility {...data} />
          </OnboardingSplitLayout>
        ),
      }),
      createUiRoute({
        parent: onboarding,
        path: "competitors",
        title: { namespace: "onboarding.competitors", key: "metaTitle" },
        loader: (input) => loadOnboardingCompetitors({ data: input }),
        preload: Competitors.preload,
        component: ({ data }) => (
          <OnboardingSplitLayout step={ONBOARDING_STEPS.COMPETITORS}>
            <Competitors {...data} />
          </OnboardingSplitLayout>
        ),
      }),
      createUiRoute({
        parent: onboarding,
        path: "connect",
        title: { namespace: "onboarding.connect", key: "metaTitle" },
        loader: (input) => loadOnboardingConnect({ data: input }),
        preload: Connect.preload,
        component: ({ data }) => (
          <OnboardingSplitLayout step={ONBOARDING_STEPS.CONNECT}>
            <Connect {...data} />
          </OnboardingSplitLayout>
        ),
      }),
    ]),
  ];
}
