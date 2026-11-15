import {
  contentPreviewRequestSchema,
  contentPreviewResultSchema,
} from "@notra/ai/schemas/content-preview";
import { logError } from "@notra/ai/utils/server-log";
import { getSite } from "@notra/sites-server/deployments";
import { isSitesConfigured } from "@notra/sites-server/env";
import { sitePreviewOrigin } from "@notra/sites-server/utils/urls";
import { isDemoMode } from "@notra/utils/demo-mode";
import { ORPCError } from "@orpc/server";

import { assertActiveSubscription } from "@/lib/billing/subscription";
import { afterResponse } from "@/lib/framework/after-response";
import { assertNotDemo } from "@/lib/orpc/utils/errors";
import { dispatchSiteJobs } from "@/lib/sites/dispatch";
import { toSitesOrpcError } from "@/lib/sites/orpc-errors";
import {
  listPostPreviewSites,
  postPreviewStatus,
  previewPostOnSite,
} from "@/lib/sites/post-preview";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";
import { ratelimit } from "@/utils/ratelimit";

export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = contentPreviewRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const input = parsed.data;
  const { organizationId, postId, operation } = input;
  try {
    if (!isSitesConfigured() || isDemoMode()) {
      return Response.json(
        { error: "Notra Sites is not available" },
        { status: 403 }
      );
    }
    const candidates = await listPostPreviewSites(organizationId, postId);
    if (operation === "list_sites") {
      return Response.json(
        contentPreviewResultSchema.parse({ operation, sites: candidates })
      );
    }
    if (!candidates.some((site) => site.id === input.siteId)) {
      return Response.json(
        { error: "No compatible site found for this post" },
        { status: 404 }
      );
    }
    const site = await getSite(input.siteId);
    if (
      !site ||
      site.organizationId !== organizationId ||
      site.status !== "active"
    ) {
      return Response.json({ error: "Site not found" }, { status: 404 });
    }
    if (operation === "status") {
      return Response.json(
        contentPreviewResultSchema.parse({
          operation,
          preview: await postPreviewStatus(site, postId),
        })
      );
    }
    assertNotDemo();
    await assertActiveSubscription(organizationId);
    if (
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      const { success } = await ratelimit.githubPublish.limit(
        `agent-preview:${organizationId}`
      );
      if (!success) {
        return Response.json(
          { error: "Too many content preview requests" },
          { status: 429 }
        );
      }
    }
    const result = await previewPostOnSite({
      site,
      postId,
      lifetime: input.lifetime,
      password: input.password,
    });
    afterResponse(() => dispatchSiteJobs([result.jobId]));
    return Response.json(
      contentPreviewResultSchema.parse({
        operation,
        status: "queued",
        url: `${sitePreviewOrigin(site.slug, result.previewKey)}${result.pagePath}`,
      })
    );
  } catch (error) {
    const mapped = toSitesOrpcError(error);
    if (mapped instanceof ORPCError && mapped.status < 500) {
      return Response.json(
        { error: mapped.message },
        { status: mapped.status }
      );
    }
    logError("Failed to prepare content preview", error, {
      organizationId,
      postId,
      operation,
    });
    return Response.json(
      {
        error:
          "Content preview failed. Check its status before deploying again.",
      },
      { status: 502 }
    );
  }
}
