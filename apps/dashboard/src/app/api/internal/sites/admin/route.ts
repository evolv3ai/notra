import { logError } from "@notra/ai/utils/server-log";
import { GeoTinybirdError } from "@notra/geo-core/geo/errors";
import { loadSiteAnalytics } from "@notra/geo-core/geo/web-analytics";
import { geoWindow } from "@notra/geo-core/geo/window";
import { siteAdminRequestSchema } from "@notra/schemas/api/site-admin";
import {
  deployBranchHead,
  redeploy,
  rollbackToDeployment,
} from "@notra/sites-server/deploy";
import { getSite } from "@notra/sites-server/deployments";
import { isSitesConfigured } from "@notra/sites-server/env";
import {
  SiteInputError,
  SiteNotBuildableError,
  SitePermanentBuildError,
} from "@notra/sites-server/errors/sites";
import {
  setOrganizationSuspended,
  setSiteSuspended,
} from "@notra/sites-server/sites";
import { Effect } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { dispatchSiteJobs } from "@/lib/sites/dispatch";
import { notifySuspension } from "@/lib/sites/suspension-notice";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Site operations for the Notra admin console.
 *
 * Enqueueing a build and starting its Vercel Workflow run, restoring a
 * deployment, suspending a site or a whole workspace (with the owner email)
 * and reading Tinybird analytics all depend on `@notra/sites-server` and the
 * dashboard's workflow and GEO layers. The console calls this route instead
 * of reimplementing them. The caller is already a verified Notra admin, so
 * there is no organization membership check; `actorId` is recorded on the
 * deployments it requests and on the abuse audit rows.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = siteAdminRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const input = parsed.data;
  // A workspace suspension checks its category in setOrganizationSuspended,
  // because a retry keeps the one the workspace was suspended with.
  if (input.action === "setSuspended" && input.suspended && !input.category) {
    return Response.json(
      { error: "A suspension needs a category" },
      { status: 400 }
    );
  }
  if (input.action === "setOrganizationSuspended") {
    try {
      const result = await setOrganizationSuspended({
        organizationId: input.organizationId,
        suspended: input.suspended,
        reason: input.reason,
        category: input.category,
        actorUserId: input.actorId,
      });
      const noticeSent = result.notice
        ? await notifySuspension({
            organizationId: input.organizationId,
            scope: "workspace",
            ...result.notice,
          })
        : null;
      return Response.json({
        ok: true,
        retry: result.retry,
        sites: result.sites.length,
        failed: result.failed,
        noticeSent,
      });
    } catch (error) {
      if (error instanceof SiteInputError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      logError("Organization suspension failed", error, {
        organizationId: input.organizationId,
      });
      return Response.json(
        { error: "Organization suspension failed" },
        { status: 500 }
      );
    }
  }
  // Only builds need the full builder setup. Suspending or restoring a site
  // must remain possible when builder credentials are unavailable.
  if (
    (input.action === "deployLatest" || input.action === "redeploy") &&
    !isSitesConfigured()
  ) {
    return Response.json(
      { error: "Notra Sites is not configured on this environment" },
      { status: 503 }
    );
  }

  try {
    const site = await getSite(input.siteId);
    if (!site) {
      return Response.json({ error: "Site not found" }, { status: 404 });
    }
    switch (input.action) {
      case "deployLatest": {
        const jobId = await deployBranchHead(site, {
          trigger: "manual",
          userId: input.actorId,
        });
        await dispatchSiteJobs([jobId]);
        return Response.json({ ok: true });
      }
      case "redeploy": {
        const jobId = await redeploy(site, input.deploymentId, input.actorId);
        await dispatchSiteJobs([jobId]);
        return Response.json({ ok: true });
      }
      case "rollback": {
        await rollbackToDeployment(site, input.deploymentId);
        return Response.json({ ok: true });
      }
      case "setSuspended": {
        const transition = await setSiteSuspended(site, input.suspended, {
          by: "notra",
          reason: input.reason,
          category: input.category,
          actorUserId: input.actorId,
        });
        const noticeSent = transition.notice
          ? await notifySuspension({
              organizationId: site.organizationId,
              scope: "site",
              siteNames: [site.name],
              ...transition.notice,
            })
          : null;
        return Response.json({
          ok: true,
          retry: transition.retry,
          failed: 0,
          noticeSent,
        });
      }
      case "analytics": {
        const analytics = await Effect.runPromise(
          loadSiteAnalytics(site, geoWindow({ days: input.days })).pipe(
            Effect.provide(geoCoreDashboardLayer)
          )
        );
        return Response.json(analytics);
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    if (
      error instanceof SiteInputError ||
      error instanceof SiteNotBuildableError ||
      error instanceof SitePermanentBuildError
    ) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GeoTinybirdError) {
      logError("Site admin analytics failed", error, { siteId: input.siteId });
      return Response.json(
        { error: `Tinybird: ${error.label}` },
        { status: 502 }
      );
    }
    logError("Site admin action failed", error, {
      siteId: input.siteId,
      action: input.action,
    });
    return Response.json(
      { error: "Site admin action failed" },
      { status: 500 }
    );
  }
}
