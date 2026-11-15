import { triggerSourceConfigSchema } from "@notra/schemas/dashboard/integrations";
import { Data, Effect } from "effect";

import { startEventRun } from "@/lib/workflows/start";
import type {
  DispatchEventTriggerProps,
  DispatchEventTriggersProps,
  GithubProcessedEvent,
  MatchingEventTrigger,
} from "@/types/webhooks/webhooks";
import { isPushEventIgnoredByPatterns } from "@/utils/ignore-commit-patterns";

class EventTriggerDispatchError extends Data.TaggedError(
  "EventTriggerDispatchError"
)<{ triggerId: string; cause: unknown }> {}

function shouldDispatchTrigger(
  trigger: MatchingEventTrigger,
  processedEvent: GithubProcessedEvent
) {
  const parsed = triggerSourceConfigSchema.safeParse(trigger.sourceConfig);
  if (!parsed.success) {
    return false;
  }
  const config = parsed.data;

  if (
    !(config.eventTypes ?? []).some(
      (eventType) => eventType === processedEvent.type
    )
  ) {
    return false;
  }

  const isPreRelease =
    processedEvent.type === "release" &&
    processedEvent.data.prerelease === true;
  if (isPreRelease && !(config.includePreReleases ?? true)) {
    return false;
  }

  return !isPushEventIgnoredByPatterns(
    processedEvent,
    config.ignoreCommitPatterns
  );
}

const dispatchEventTrigger = Effect.fn("dispatchEventTrigger")(function* ({
  trigger,
  processedEvent,
  repositoryId,
  deliveryId,
}: DispatchEventTriggerProps) {
  yield* Effect.tryPromise({
    try: () =>
      startEventRun({
        triggerId: trigger.id,
        eventType: processedEvent.type,
        eventAction: processedEvent.action,
        eventData: processedEvent.data,
        repositoryId,
        deliveryId,
        executionId: deliveryId
          ? `event-${trigger.id}-${deliveryId}`
          : undefined,
      }),
    catch: (cause) =>
      new EventTriggerDispatchError({ triggerId: trigger.id, cause }),
  });
});

export function dispatchEventTriggers({
  triggers,
  processedEvent,
  repositoryId,
  deliveryId,
}: DispatchEventTriggersProps) {
  const matching = triggers.filter((trigger) =>
    shouldDispatchTrigger(trigger, processedEvent)
  );

  return Effect.runPromise(
    Effect.forEach(
      matching,
      (trigger) =>
        dispatchEventTrigger({
          trigger,
          processedEvent,
          repositoryId,
          deliveryId,
        }).pipe(
          Effect.catch((error) =>
            Effect.logError(
              `Failed to trigger event workflow for trigger ${error.triggerId}`,
              error.cause
            )
          )
        ),
      { concurrency: "unbounded", discard: true }
    )
  );
}
