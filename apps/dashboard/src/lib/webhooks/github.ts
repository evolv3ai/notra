import crypto from "node:crypto";

import { getGitHubWebhookIntegrations } from "@notra/ai/integrations/github-webhooks";
import { redis } from "@notra/ai/utils/redis";
import { db } from "@notra/db/drizzle";
import { contentTriggers } from "@notra/db/schema";
import { decryptToken } from "@notra/db/utils/integration-encryption";
import {
  type GitHubEventType,
  type GitHubWebhookPayload,
  githubWebhookPayloadSchema,
  isGitHubEventType,
} from "@notra/schemas/dashboard/github-webhook";
import { and, eq, sql } from "drizzle-orm";

import { checkLogRetention } from "@/lib/billing/check-log-retention";
import { dispatchEventTriggers } from "@/lib/webhooks/dispatch-event-triggers";
import { appendWebhookLog } from "@/lib/webhooks/logging";
import type {
  GithubProcessedEvent,
  WebhookContext,
  WebhookLogInput,
} from "@/types/webhooks/webhooks";
import { authorizeWebhookIntegration } from "@/utils/webhook-integration";

const DELIVERY_TTL_SECONDS = 60 * 60 * 24;
const SHOULD_DEDUPE_DELIVERIES = process.env.NODE_ENV !== "development";

async function isDeliveryProcessed(deliveryId: string) {
  if (!(redis && deliveryId)) {
    return false;
  }
  const key = `webhook:delivery:${deliveryId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

async function markDeliveryProcessed(deliveryId: string) {
  if (!(redis && deliveryId)) {
    return;
  }
  const key = `webhook:delivery:${deliveryId}`;
  await redis.set(key, "1", { ex: DELIVERY_TTL_SECONDS });
}

function verifySignature(payload: string, signature: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  const digestBuffer = Buffer.from(digest);
  const signatureBuffer = Buffer.from(signature);
  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}

function processReleaseEvent(
  action: string,
  payload: GitHubWebhookPayload
): GithubProcessedEvent | null {
  const validActions = ["published", "prereleased"];
  if (!validActions.includes(action)) {
    return null;
  }

  const release = payload.release;
  if (!release) {
    return null;
  }

  if (release.draft) {
    return null;
  }

  return {
    type: "release",
    action,
    data: {
      tagName: release.tag_name,
      name: release.name,
      body: release.body,
      prerelease: release.prerelease,
      draft: release.draft,
      publishedAt: release.published_at,
      url: release.html_url,
    },
  };
}

function processPushEvent(
  payload: GitHubWebhookPayload
): GithubProcessedEvent | null {
  const ref = payload.ref;
  const defaultBranch = payload.repository?.default_branch;
  const commits = payload.commits;

  if (!(ref && defaultBranch) || ref !== `refs/heads/${defaultBranch}`) {
    return null;
  }

  if (!commits || commits.length === 0) {
    return null;
  }

  return {
    type: "push",
    action: "pushed",
    data: {
      ref,
      branch: defaultBranch,
      commits: commits.map((c) => ({
        id: c.id,
        message: c.message,
        author: c.author,
        timestamp: c.timestamp,
        url: c.url,
      })),
      headCommit: payload.head_commit
        ? {
            id: payload.head_commit.id,
            message: payload.head_commit.message,
          }
        : null,
    },
  };
}

export async function handleGitHubWebhook(
  context: WebhookContext
): Promise<Response> {
  const { request, repositoryId, organizationId, integrationId } = context;

  const records = await getGitHubWebhookIntegrations(
    integrationId,
    repositoryId
  );
  const integration = authorizeWebhookIntegration(
    records.find((record) => record.id === integrationId),
    organizationId
  );
  if (integration instanceof Response) {
    return integration;
  }
  const repository = records.find((record) => record.id === repositoryId);
  if (!repository) {
    return Response.json({ error: "Repository not found" }, { status: 404 });
  }
  if (repository.id !== integration.id) {
    return Response.json(
      { error: "Repository does not belong to this integration" },
      { status: 403 }
    );
  }

  const rawBody = await request.text();

  const eventHeader = request.headers.get("x-github-event");
  const signature = request.headers.get("x-hub-signature-256");
  const delivery = request.headers.get("x-github-delivery");
  const log = (
    entry: Omit<
      WebhookLogInput,
      "organizationId" | "integrationId" | "integrationType" | "referenceId"
    >
  ) =>
    appendWebhookLog({
      organizationId,
      integrationId,
      integrationType: "github",
      referenceId: delivery ?? null,
      ...entry,
    });

  if (!eventHeader) {
    await log({
      title: "Missing webhook event header",
      status: "failed",
      statusCode: 400,
      errorMessage: "Missing X-GitHub-Event header",
    });

    return Response.json(
      { error: "Missing X-GitHub-Event header" },
      { status: 400 }
    );
  }

  if (!isGitHubEventType(eventHeader)) {
    await log({
      title: `Unsupported event type: ${eventHeader}`,
      status: "success",
      statusCode: 200,
      payload: { event: eventHeader, ignored: true },
    });

    return Response.json({
      message: `Event type '${eventHeader}' is not supported`,
      event: eventHeader,
      ignored: true,
    });
  }

  const event: GitHubEventType = eventHeader;

  if (
    SHOULD_DEDUPE_DELIVERIES &&
    delivery &&
    (await isDeliveryProcessed(delivery))
  ) {
    return Response.json({
      message: "Webhook already processed (duplicate delivery)",
      event,
      delivery,
      duplicate: true,
    });
  }

  const secret = repository.encryptedWebhookSecret
    ? decryptToken(repository.encryptedWebhookSecret)
    : null;
  if (!secret) {
    await log({
      title: "Webhook secret missing",
      status: "failed",
      statusCode: 400,
      errorMessage: "Webhook secret not configured",
    });

    return Response.json(
      { error: "Webhook secret not configured for this repository" },
      { status: 400 }
    );
  }

  if (!signature) {
    await log({
      title: "Signature missing",
      status: "failed",
      statusCode: 400,
      errorMessage: "Missing X-Hub-Signature-256 header",
    });

    return Response.json(
      { error: "Missing X-Hub-Signature-256 header" },
      { status: 400 }
    );
  }

  if (!verifySignature(rawBody, signature, secret)) {
    await log({
      title: "Invalid webhook signature",
      status: "failed",
      statusCode: 401,
      errorMessage: "Invalid webhook signature",
    });

    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  const logRetentionDays = await checkLogRetention(organizationId);

  if (event === "ping") {
    await log({
      title: "Webhook ping received",
      status: "success",
      statusCode: 200,
      payload: { event: "ping" },
      retentionDays: logRetentionDays,
    });

    return Response.json({
      message: "Pong! Webhook configured successfully",
      event: "ping",
      delivery,
    });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    await log({
      title: "Invalid webhook payload",
      status: "failed",
      statusCode: 400,
      errorMessage: "Invalid JSON payload",
      retentionDays: logRetentionDays,
    });

    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validation = githubWebhookPayloadSchema.safeParse(parsedBody);
  if (!validation.success) {
    await log({
      title: "Invalid webhook payload structure",
      status: "failed",
      statusCode: 400,
      errorMessage: `Payload validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
      retentionDays: logRetentionDays,
    });

    return Response.json(
      { error: "Invalid webhook payload structure" },
      { status: 400 }
    );
  }

  const payload = validation.data;
  const action = payload.action ?? "";

  let processedEvent: GithubProcessedEvent | null = null;

  switch (event) {
    case "release":
      processedEvent = processReleaseEvent(action, payload);
      break;
    case "push":
      processedEvent = processPushEvent(payload);
      break;
    default:
      await log({
        title: `Ignored ${event} event`,
        status: "success",
        statusCode: 200,
        payload: { event, action, ignored: true },
        retentionDays: logRetentionDays,
      });

      return Response.json({
        message: `Event type '${event}' is not processed`,
        event,
        action,
        ignored: true,
      });
  }

  if (!processedEvent) {
    await log({
      title: `Filtered ${event} event`,
      status: "success",
      statusCode: 200,
      payload: { event, action, filtered: true },
      retentionDays: logRetentionDays,
    });

    return Response.json({
      message: `Event '${event}' with action '${action}' was filtered out`,
      event,
      action,
      filtered: true,
    });
  }

  await log({
    title: `Processed ${processedEvent.type} event`,
    status: "success",
    statusCode: 200,
    payload: {
      event,
      action: processedEvent.action,
      data: processedEvent.data,
    },
    retentionDays: logRetentionDays,
  });

  const matchingTriggers = await db
    .select({
      id: contentTriggers.id,
      sourceConfig: contentTriggers.sourceConfig,
    })
    .from(contentTriggers)
    .where(
      and(
        eq(contentTriggers.organizationId, organizationId),
        eq(contentTriggers.sourceType, "github_webhook"),
        eq(contentTriggers.enabled, true),
        sql`(${contentTriggers.targets}->'repositoryIds') @> ${JSON.stringify([repositoryId])}::jsonb`
      )
    );

  await dispatchEventTriggers({
    triggers: matchingTriggers,
    processedEvent,
    repositoryId,
    deliveryId: delivery ?? undefined,
  });

  if (SHOULD_DEDUPE_DELIVERIES && delivery) {
    await markDeliveryProcessed(delivery);
  }

  return Response.json({
    message: `Processed ${processedEvent.type} event (${processedEvent.action})`,
    event,
    delivery,
    processed: processedEvent,
    repository: {
      id: payload.repository?.id,
      fullName: payload.repository?.full_name,
    },
  });
}
