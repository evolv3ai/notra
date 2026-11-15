import { Databuddy } from "@databuddy/sdk/node";
import { logWarn } from "@notra/ai/utils/server-log";
import type {
  ContentCreatedTrackingEvent,
  ContentFailedTrackingEvent,
  ContentSkippedTrackingEvent,
} from "@notra/content-generation/databuddy";
import {
  buildContentCreatedDatabuddyProperties,
  buildContentFailedDatabuddyProperties,
  buildContentSkippedDatabuddyProperties,
  CONTENT_CREATED_DATABUDDY_EVENT,
  CONTENT_FAILED_DATABUDDY_EVENT,
  CONTENT_SKIPPED_DATABUDDY_EVENT,
} from "@notra/content-generation/databuddy";

const apiKey = process.env.DATABUDDY_API_KEY;
const websiteId = process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID;

if (!apiKey) {
  logWarn(
    "DATABUDDY_API_KEY not configured. Server-side Databuddy tracking will be disabled."
  );
}

if (!websiteId) {
  logWarn(
    "NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID not configured. Server-side Databuddy tracking will be disabled."
  );
}

const databuddy =
  apiKey && websiteId
    ? new Databuddy({
        websiteId,
        apiKey,
        enableBatching: false,
      })
    : null;

const isDevelopment = process.env.NODE_ENV === "development";

async function trackWorkflowEvent(
  name: string,
  source: string | undefined,
  properties: Record<string, unknown>,
  logContext: Record<string, unknown>
): Promise<void> {
  if (!databuddy) {
    return;
  }

  try {
    const result = await databuddy.track({
      name,
      namespace: "workflows",
      source: source ?? "schedule",
      properties,
    });

    if (!result.success && isDevelopment) {
      logWarn(`[Databuddy] ${name} failed`, {
        ...logContext,
        error: result.error,
      });
    }
  } catch (error) {
    if (isDevelopment) {
      logWarn(`[Databuddy] ${name} error`, {
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function trackScheduledContentCreated(
  event: ContentCreatedTrackingEvent
): Promise<void> {
  return trackWorkflowEvent(
    CONTENT_CREATED_DATABUDDY_EVENT,
    event.source,
    buildContentCreatedDatabuddyProperties(event),
    { triggerId: event.triggerId, postId: event.postId }
  );
}

export function trackScheduledContentFailed(
  event: ContentFailedTrackingEvent
): Promise<void> {
  return trackWorkflowEvent(
    CONTENT_FAILED_DATABUDDY_EVENT,
    event.source,
    buildContentFailedDatabuddyProperties(event),
    { triggerId: event.triggerId }
  );
}

export function trackScheduledContentSkipped(
  event: ContentSkippedTrackingEvent
): Promise<void> {
  return trackWorkflowEvent(
    CONTENT_SKIPPED_DATABUDDY_EVENT,
    event.source,
    buildContentSkippedDatabuddyProperties(event),
    { triggerId: event.triggerId }
  );
}
