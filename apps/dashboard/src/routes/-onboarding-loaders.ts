import { db } from "@notra/db/drizzle";
import {
  brandSettings,
  organizationNotificationSettings,
  organizations,
  users,
} from "@notra/db/schema";
import { normalizeCompetitorDomain } from "@notra/geo-core/geo/domain";
import {
  getGeoOnboardingSnapshot,
  getGeoOnboardingStage,
} from "@notra/geo-core/geo/onboarding-status";
import { preferredGeoLanguage } from "@notra/geo-core/utils/geo-locale-language";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { ONBOARDING_FLOW_VARIANTS } from "@/constants/analytics-events";
import {
  ONBOARDING_STEP_COMPETITORS,
  ONBOARDING_STEP_VISIBILITY,
  ONBOARDING_STEP_WORKSPACE,
} from "@/constants/onboarding";
import { WELCOME_TOUR_SEARCH_PARAM } from "@/constants/welcome-tour";
import {
  getLastActiveOrganization,
  getSession,
  validateOrganizationAccess,
} from "@/lib/auth/actions";
import { hasPaidSubscriptionHistory } from "@/lib/billing/subscription";
import { resolveGeoAccessLevel } from "@/lib/geo/access-level.server";
import { redirectIfAnyOrganizationHasPaidHistory } from "@/lib/onboarding/billing-gate";
import { redirectIfOnboardingDismissed } from "@/lib/onboarding/dismissal";
import { resolveOnboardingVariant } from "@/lib/onboarding/experiment";
import type { OnboardingLayoutContext } from "@/types/onboarding-layout";
import type { UiRouteInput } from "@/types/ui-route";
import {
  geoDashboardPath,
  geoOnboardingCompetitorsPath,
  geoOnboardingConnectPath,
  geoOnboardingPath,
  geoOnboardingWorkspacePath,
  geoTrafficPath,
  withGeoProject,
} from "@/utils/geo-paths";
import { onboardingProgressHrefs } from "@/utils/onboarding-progress";

async function onboardingContext({ searchParams }: UiRouteInput) {
  const session = await getSession();
  if (!session?.user) {
    throw redirect({ href: "/login" });
  }
  const organization = await getLastActiveOrganization();
  const projectId =
    typeof searchParams.project === "string" && searchParams.project
      ? searchParams.project
      : undefined;
  const replay =
    process.env.NODE_ENV === "development" && searchParams.replay === "1";
  return { organization, projectId, replay, userId: session.user.id };
}

/** Only workspaces with nothing to show in GEO land on AI traffic. */
async function onboardingExitHref(
  organizationId: string,
  organizationSlug: string,
  projectId?: string
) {
  const access = await Effect.runPromise(resolveGeoAccessLevel(organizationId));
  return access === "locked"
    ? geoTrafficPath(organizationSlug, projectId)
    : geoDashboardPath(organizationSlug, projectId);
}

async function onboardingFinishHref(
  organizationId: string,
  organizationSlug: string,
  projectId?: string
) {
  const href = await onboardingExitHref(
    organizationId,
    organizationSlug,
    projectId
  );
  return `${href}${href.includes("?") ? "&" : "?"}${WELCOME_TOUR_SEARCH_PARAM}=1`;
}

async function onboardingBrandContext(input: UiRouteInput) {
  const { organization, projectId, replay, userId } =
    await onboardingContext(input);
  if (!organization) {
    throw redirect({ href: "/onboarding/workspace" });
  }
  const brand = await db.query.brandSettings.findFirst({
    where: eq(brandSettings.organizationId, organization.id),
    columns: { websiteUrl: true, companyName: true },
  });
  if (!brand) {
    throw redirect({ href: "/onboarding/workspace" });
  }
  await redirectIfOnboardingDismissed(
    organization.id,
    organization.slug,
    projectId,
    replay
  );
  return { organization, projectId, replay, brand, userId };
}

export const loadOnboardingLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnboardingLayoutContext> => {
    const [session, organization] = await Promise.all([
      getSession(),
      getLastActiveOrganization(),
    ]);
    const [member, onboardingVariant] = await Promise.all([
      organization
        ? validateOrganizationAccess(organization.slug).then(
            (access) => access.member
          )
        : null,
      session?.user
        ? resolveOnboardingVariant(session.user.id)
        : ONBOARDING_FLOW_VARIANTS.CONTROL,
    ]);
    return {
      organizationSlug: organization?.slug ?? null,
      canSkip: member?.role === "owner" || member?.role === "admin",
      onboardingVariant,
    };
  }
);

export const loadOnboardingEntry = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data }) => {
    const { organization, projectId, replay } = await onboardingContext(data);
    await redirectIfAnyOrganizationHasPaidHistory();
    if (!organization) {
      throw redirect({ href: geoOnboardingWorkspacePath(projectId, replay) });
    }
    await redirectIfOnboardingDismissed(
      organization.id,
      organization.slug,
      projectId,
      replay
    );
    const brand = await db.query.brandSettings.findFirst({
      where: eq(brandSettings.organizationId, organization.id),
      columns: { id: true },
    });
    if (!brand) {
      throw redirect({ href: geoOnboardingWorkspacePath(projectId, replay) });
    }
    const stage = await getGeoOnboardingStage(organization.id, projectId);
    if (stage === "brand") {
      throw redirect({ href: geoOnboardingPath(projectId, replay) });
    }
    if (stage === "competitors") {
      throw redirect({ href: geoOnboardingCompetitorsPath(projectId, replay) });
    }
    throw redirect({
      href: withGeoProject(`/${organization.slug}`, projectId),
    });
  });

export const loadOnboardingWorkspace = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data }) => {
    const { organization, projectId, replay, userId } =
      await onboardingContext(data);
    if (!organization) {
      await redirectIfAnyOrganizationHasPaidHistory();
      return { existingOrg: undefined, progressHrefs: undefined };
    }
    await redirectIfOnboardingDismissed(
      organization.id,
      organization.slug,
      projectId,
      replay
    );
    const [brand, existingOrg, notificationSettings, stage, user] =
      await Promise.all([
        db.query.brandSettings.findFirst({
          where: eq(brandSettings.organizationId, organization.id),
          columns: { id: true, websiteUrl: true },
        }),
        db.query.organizations.findFirst({
          where: eq(organizations.id, organization.id),
          columns: {
            heardAboutNotraOther: true,
            heardAboutNotraSource: true,
            id: true,
            logo: true,
            slug: true,
            name: true,
          },
        }),
        db.query.organizationNotificationSettings.findFirst({
          where: eq(
            organizationNotificationSettings.organizationId,
            organization.id
          ),
          columns: { dailySummary: true },
        }),
        getGeoOnboardingStage(organization.id, projectId),
        db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { marketingOptInAt: true },
        }),
      ]);
    return {
      existingOrg: existingOrg
        ? {
            ...existingOrg,
            dailySummary: notificationSettings?.dailySummary ?? true,
            marketingEmails: Boolean(user?.marketingOptInAt),
            hasBrand: Boolean(brand),
            websiteUrl: brand?.websiteUrl ?? null,
          }
        : undefined,
      progressHrefs: onboardingProgressHrefs({
        current: ONBOARDING_STEP_WORKSPACE,
        hasOrganization: true,
        hasBrand: Boolean(brand),
        projectId,
        replay,
        stage,
      }),
    };
  });

export const loadOnboardingVisibility = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data }) => {
    const { organization, projectId, replay, brand } =
      await onboardingBrandContext(data);
    const [{ stage, languages }, paid, skipHref] = await Promise.all([
      getGeoOnboardingSnapshot(organization.id, projectId),
      hasPaidSubscriptionHistory(organization.id),
      onboardingExitHref(organization.id, organization.slug, projectId),
    ]);
    const inOnboardingFlow = replay || !paid;
    return {
      companyName: brand.companyName,
      initialLanguages: languages?.languages ?? [
        preferredGeoLanguage(getRequestHeaders().get("accept-language")),
      ],
      lockedLanguage: languages?.promptLanguage ?? null,
      inOnboardingFlow,
      nextHref: geoOnboardingCompetitorsPath(projectId, replay),
      organizationId: organization.id,
      progressHrefs: onboardingProgressHrefs({
        current: ONBOARDING_STEP_VISIBILITY,
        hasBrand: true,
        hasOrganization: true,
        projectId,
        replay,
        stage,
      }),
      projectId,
      skipHref,
      websiteUrl: brand.websiteUrl,
    };
  });

export const loadOnboardingCompetitors = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data }) => {
    const { organization, projectId, replay, brand, userId } =
      await onboardingBrandContext(data);
    const [stage, paid, exitHref, finishHref, variant] = await Promise.all([
      getGeoOnboardingStage(organization.id, projectId),
      hasPaidSubscriptionHistory(organization.id),
      onboardingExitHref(organization.id, organization.slug, projectId),
      onboardingFinishHref(organization.id, organization.slug, projectId),
      resolveOnboardingVariant(userId),
    ]);
    const inOnboardingFlow = replay || !paid;
    if (!replay && stage === "brand") {
      throw redirect({ href: geoOnboardingPath(projectId) });
    }
    let nextHref = exitHref;
    if (inOnboardingFlow) {
      nextHref =
        variant === ONBOARDING_FLOW_VARIANTS.NO_EXTRA_STEPS
          ? finishHref
          : geoOnboardingConnectPath(projectId, replay);
    }
    return {
      companyName: brand.companyName ?? "",
      domain: normalizeCompetitorDomain(brand.websiteUrl),
      inOnboardingFlow,
      nextHref,
      organizationId: organization.id,
      progressHrefs: onboardingProgressHrefs({
        current: ONBOARDING_STEP_COMPETITORS,
        hasBrand: true,
        hasOrganization: true,
        projectId,
        replay,
        stage,
      }),
      projectId,
    };
  });

export const loadOnboardingConnect = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data }) => {
    const { organization, projectId, brand } =
      await onboardingBrandContext(data);
    return {
      companyName: brand.companyName ?? "",
      nextHref: await onboardingFinishHref(
        organization.id,
        organization.slug,
        projectId
      ),
    };
  });
