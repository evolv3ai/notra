import { POSTHOG_GROUP_TYPES } from "@notra/posthog/constants/posthog";
import {
  getPostHogRequestContext,
  resolvePostHogDistinctId,
} from "@notra/posthog/request";
import {
  captureServerEvent,
  captureServerException,
  flushPostHogServer,
  identifyServerGroup,
  setServerPersonProperties,
} from "@notra/posthog/server";

import { runAfterResponse } from "@/lib/after-response";
import type {
  IdentifyOrganizationGroupInput,
  IdentifyProjectGroupInput,
  SetPersonPropertiesInput,
  TrackServerEventInput,
  TrackServerExceptionInput,
} from "@/types/analytics/posthog";

function scheduleCapture(capture: () => void): void {
  runAfterResponse("[posthog] capture delivery failed", async () => {
    capture();
    await flushPostHogServer();
  });
}

function eventCapture(input: TrackServerEventInput): () => void {
  const requestContext = getPostHogRequestContext(input.headers);
  return () =>
    captureServerEvent({
      event: input.event,
      distinctId: resolvePostHogDistinctId(requestContext, input.userId),
      sessionId: requestContext.sessionId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      properties: input.properties,
    });
}

export function trackServerEvent(input: TrackServerEventInput): void {
  scheduleCapture(eventCapture(input));
}

export async function trackServerEventAndFlush(
  input: TrackServerEventInput
): Promise<void> {
  eventCapture(input)();
  await flushPostHogServer();
}

export function trackServerException(input: TrackServerExceptionInput): void {
  const requestContext = getPostHogRequestContext(input.headers);
  scheduleCapture(() =>
    captureServerException({
      error: input.error,
      distinctId: resolvePostHogDistinctId(requestContext, input.userId),
      sessionId: requestContext.sessionId,
      organizationId: input.organizationId,
      properties: input.properties,
    })
  );
}

export function identifyOrganizationGroup(
  input: IdentifyOrganizationGroupInput
): void {
  scheduleCapture(() =>
    identifyServerGroup({
      groupType: POSTHOG_GROUP_TYPES.ORGANIZATION,
      groupKey: input.organizationId,
      properties: input.properties,
      distinctId: input.userId,
    })
  );
}

export function identifyProjectGroup(input: IdentifyProjectGroupInput): void {
  scheduleCapture(() =>
    identifyServerGroup({
      groupType: POSTHOG_GROUP_TYPES.PROJECT,
      groupKey: input.projectId,
      properties: {
        ...input.properties,
        organization_id: input.organizationId,
      },
      distinctId: input.userId,
    })
  );
}

export function setPersonProperties(input: SetPersonPropertiesInput): void {
  scheduleCapture(() =>
    setServerPersonProperties({
      distinctId: input.userId,
      set: input.set,
      setOnce: input.setOnce,
    })
  );
}
