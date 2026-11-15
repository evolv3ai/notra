import {
  QstashError,
  qstashScheduleResponseSchema,
} from "@notra/schemas/api/qstash";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Context, Effect, Layer, Schedule } from "effect";

import {
  QSTASH_DELETE_ATTEMPTS,
  QSTASH_DELETE_RETRY_DELAY_MS,
  QSTASH_DESTINATION_REJECTION_PATTERN,
  QSTASH_REQUEST_TIMEOUT_MS,
} from "../constants/qstash";
import type { QstashEnv, QstashOperations } from "../types/qstash";

export class QstashService extends Context.Service<
  QstashService,
  QstashOperations
>()("api/Qstash") {}

const demoQstashLayer = Layer.succeed(
  QstashService,
  QstashService.of({
    create: Effect.fn("Qstash.createDemo")((input) =>
      Effect.succeed(input.scheduleId ?? `demo-schedule-${input.triggerId}`)
    ),
    delete: Effect.fn("Qstash.deleteDemo")(() => Effect.void),
  })
);

const missingTokenError = () =>
  new QstashError({
    kind: "configuration",
    message: "QSTASH_TOKEN is not configured",
  });

const toQstashError = (cause: unknown) =>
  cause instanceof QstashError
    ? cause
    : new QstashError({
        kind: "transport",
        message: "QStash request failed",
      });

const withQstashTimeout = Effect.timeoutOrElse({
  duration: QSTASH_REQUEST_TIMEOUT_MS,
  orElse: () =>
    Effect.fail(
      new QstashError({
        kind: "timeout",
        message: "QStash request timed out",
      })
    ),
});

export function qstashLayer(env: QstashEnv) {
  if (isDemoMode()) {
    return demoQstashLayer;
  }
  return Layer.succeed(
    QstashService,
    QstashService.of({
      create: Effect.fn("Qstash.create")(function* (input) {
        if (!env.QSTASH_TOKEN) {
          return yield* Effect.fail(missingTokenError());
        }
        if (!env.WORKFLOW_BASE_URL) {
          return yield* Effect.fail(
            new QstashError({
              kind: "destination",
              message: "WORKFLOW_BASE_URL is not configured",
            })
          );
        }
        const destination = `${env.WORKFLOW_BASE_URL.replace(/\/$/, "")}/api/workflows/schedule`;
        return yield* Effect.tryPromise({
          try: async (signal) => {
            const response = await fetch(
              `https://qstash.upstash.io/v2/schedules/${encodeURIComponent(destination)}`,
              {
                method: "POST",
                signal,
                headers: {
                  Authorization: `Bearer ${env.QSTASH_TOKEN}`,
                  "Content-Type": "application/json",
                  "Upstash-Cron": input.cron,
                  ...(input.scheduleId
                    ? { "Upstash-Schedule-Id": input.scheduleId }
                    : {}),
                },
                body: JSON.stringify({ triggerId: input.triggerId }),
              }
            );
            if (!response.ok) {
              const body = await response.text().catch(() => "");
              throw new QstashError({
                kind: QSTASH_DESTINATION_REJECTION_PATTERN.test(body)
                  ? "destination"
                  : "http",
                status: response.status,
                message:
                  `Failed to create QStash schedule: ${response.status} ${body}`.trim(),
              });
            }
            const parsed = qstashScheduleResponseSchema.safeParse(
              await response.json().catch(() => null)
            );
            const id = parsed.success
              ? (parsed.data.scheduleId ?? input.scheduleId)
              : input.scheduleId;
            if (!id) {
              throw new QstashError({
                kind: "decode",
                message: "QStash schedule id was not returned",
              });
            }
            return id;
          },
          catch: toQstashError,
        }).pipe(withQstashTimeout);
      }),
      delete: Effect.fn("Qstash.delete")(function* (scheduleId) {
        if (!env.QSTASH_TOKEN) {
          return yield* Effect.fail(missingTokenError());
        }
        yield* Effect.tryPromise({
          try: async (signal) => {
            const response = await fetch(
              `https://qstash.upstash.io/v2/schedules/${encodeURIComponent(scheduleId)}`,
              {
                method: "DELETE",
                signal,
                headers: { Authorization: `Bearer ${env.QSTASH_TOKEN}` },
              }
            );
            if (!response.ok && response.status !== 404) {
              const body = await response.text().catch(() => "");
              throw new QstashError({
                kind: "http",
                status: response.status,
                message:
                  `Failed to delete QStash schedule ${scheduleId}: ${response.status} ${body}`.trim(),
              });
            }
          },
          catch: toQstashError,
        }).pipe(withQstashTimeout);
      }),
    })
  );
}

export const deleteQstashWithRetry = Effect.fn("Qstash.deleteWithRetry")(
  function* (scheduleId: string) {
    const service = yield* QstashService;
    yield* service.delete(scheduleId).pipe(
      Effect.retry({
        schedule: Schedule.addDelay(
          Schedule.recurs(QSTASH_DELETE_ATTEMPTS - 1),
          (metadata) =>
            Effect.succeed(QSTASH_DELETE_RETRY_DELAY_MS * (metadata.output + 1))
        ),
        while: (error) =>
          error.kind === "transport" ||
          error.kind === "timeout" ||
          (error.kind === "http" &&
            error.status !== undefined &&
            (error.status === 408 ||
              error.status === 425 ||
              error.status === 429 ||
              error.status >= 500)),
      })
    );
  }
);
