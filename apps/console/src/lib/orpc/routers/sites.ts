import { SITE_RECENT_BUILDS_LIMIT } from "@/constants/sites";
import { assertAdmin } from "@/lib/auth/admin";
import { baseProcedure } from "@/lib/orpc/base";
import { callSiteAdmin } from "@/lib/sites/dashboard";
import {
  getAdminSite,
  getBuildActivity,
  getRecentBuilds,
  getAdminSiteDeployment,
  getSitesOverview,
  listAdminSites,
} from "@/lib/sites/queries";
import {
  siteAnalyticsInputSchema,
  siteBuildActivityInputSchema,
  siteDeploymentInputSchema,
  siteInputSchema,
  siteSuspendInputSchema,
} from "@/schemas/sites";
import type { SiteAdminSuspendResponse } from "@/types/moderation";
import type { SiteAnalytics } from "@/types/sites";

import { notFound } from "../utils/errors";

export const sitesRouter = {
  overview: baseProcedure.handler(async ({ context }) => {
    await assertAdmin({ headers: context.headers });
    return getSitesOverview();
  }),

  list: baseProcedure.handler(async ({ context }) => {
    await assertAdmin({ headers: context.headers });
    return listAdminSites();
  }),

  buildActivity: baseProcedure
    .input(siteBuildActivityInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      const [days, builds] = await Promise.all([
        getBuildActivity(input.days, input.siteId),
        getRecentBuilds(SITE_RECENT_BUILDS_LIMIT, input.siteId),
      ]);
      return { days, builds };
    }),

  get: baseProcedure
    .input(siteInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      const detail = await getAdminSite(input.siteId);
      if (!detail) {
        throw notFound("Site not found");
      }
      return detail;
    }),

  analytics: baseProcedure
    .input(siteAnalyticsInputSchema)
    .handler(async ({ context, input }) => {
      const { user } = await assertAdmin({ headers: context.headers });
      // The dashboard owns the Tinybird client and its response shape.
      return (await callSiteAdmin({
        action: "analytics",
        siteId: input.siteId,
        actorId: user.id,
        days: input.days,
      })) as SiteAnalytics;
    }),

  deployments: {
    get: baseProcedure
      .input(siteDeploymentInputSchema)
      .handler(async ({ context, input }) => {
        await assertAdmin({ headers: context.headers });
        const detail = await getAdminSiteDeployment(
          input.siteId,
          input.deploymentId
        );
        if (!detail) {
          throw notFound("Deployment not found");
        }
        return detail;
      }),

    deployLatest: baseProcedure
      .input(siteInputSchema)
      .handler(async ({ context, input }) => {
        const { user } = await assertAdmin({ headers: context.headers });
        await callSiteAdmin({
          action: "deployLatest",
          siteId: input.siteId,
          actorId: user.id,
        });
        return { ok: true };
      }),

    redeploy: baseProcedure
      .input(siteDeploymentInputSchema)
      .handler(async ({ context, input }) => {
        const { user } = await assertAdmin({ headers: context.headers });
        await callSiteAdmin({
          action: "redeploy",
          siteId: input.siteId,
          deploymentId: input.deploymentId,
          actorId: user.id,
        });
        return { ok: true };
      }),

    rollback: baseProcedure
      .input(siteDeploymentInputSchema)
      .handler(async ({ context, input }) => {
        const { user } = await assertAdmin({ headers: context.headers });
        await callSiteAdmin({
          action: "rollback",
          siteId: input.siteId,
          deploymentId: input.deploymentId,
          actorId: user.id,
        });
        return { ok: true };
      }),
  },

  setSuspended: baseProcedure
    .input(siteSuspendInputSchema)
    .handler(async ({ context, input }) => {
      const { user } = await assertAdmin({ headers: context.headers });
      return (await callSiteAdmin({
        action: "setSuspended",
        siteId: input.siteId,
        actorId: user.id,
        suspended: input.suspended,
        reason: input.reason,
        category: input.category,
      })) as SiteAdminSuspendResponse;
    }),
};
