import { createHmac, timingSafeEqual } from "node:crypto";

import {
  getDecryptedLinearWebhookSecret,
  getLinearIntegrationById,
} from "@notra/ai/integrations/linear";
import {
  type LinearWebhookPayload,
  linearWebhookPayloadSchema,
} from "@notra/schemas/dashboard/linear";

import { checkLogRetention } from "@/lib/billing/check-log-retention";
import { appendWebhookLog } from "@/lib/webhooks/logging";
import type {
  WebhookContext,
  WebhookLogInput,
} from "@/types/webhooks/webhooks";
import { authorizeWebhookIntegration } from "@/utils/webhook-integration";

export async function handleLinearWebhook(
  context: WebhookContext
): Promise<Response> {
  const { request, organizationId, integrationId } = context;
  const integration = authorizeWebhookIntegration(
    await getLinearIntegrationById(integrationId),
    organizationId
  );
  if (integration instanceof Response) {
    return integration;
  }
  const rawBody = await request.text();
  const signature = request.headers.get("linear-signature");
  const log = (
    entry: Omit<
      WebhookLogInput,
      "organizationId" | "integrationId" | "integrationType" | "referenceId"
    >
  ) =>
    appendWebhookLog({
      organizationId,
      integrationId,
      integrationType: "linear",
      referenceId: null,
      ...entry,
    });

  if (!signature) {
    await log({
      title: "Missing Linear signature",
      status: "failed",
      statusCode: 400,
      errorMessage: "Missing Linear-Signature header",
    });

    return Response.json(
      { error: "Missing Linear-Signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = await getDecryptedLinearWebhookSecret(integrationId);
  if (!webhookSecret) {
    return Response.json(
      { error: "Webhook secret not configured for this integration" },
      { status: 500 }
    );
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const isValid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!isValid) {
    await log({
      title: "Invalid webhook signature",
      status: "failed",
      statusCode: 401,
      errorMessage: "Linear webhook signature verification failed",
    });

    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    await log({
      title: "Invalid webhook payload",
      status: "failed",
      statusCode: 400,
      errorMessage: "Could not parse webhook payload",
    });

    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const validation = linearWebhookPayloadSchema.safeParse(parsedBody);
  if (!validation.success) {
    await log({
      title: "Invalid webhook payload structure",
      status: "failed",
      statusCode: 400,
      errorMessage: `Payload validation failed: ${validation.error.issues.map((issue) => issue.message).join(", ")}`,
    });

    return Response.json(
      { error: "Invalid webhook payload structure" },
      { status: 400 }
    );
  }

  const payload: LinearWebhookPayload = validation.data;

  const logRetentionDays = await checkLogRetention(organizationId);

  const eventTitle = payload.type
    ? `Linear ${payload.type} ${payload.action ?? "event"}`
    : "Linear webhook received";

  await log({
    title: eventTitle,
    status: "success",
    statusCode: 200,
    payload: {
      action: payload.action,
      type: payload.type,
      hasSignature: true,
    },
    retentionDays: logRetentionDays,
  });

  return Response.json({ message: "Received Linear webhook" });
}
