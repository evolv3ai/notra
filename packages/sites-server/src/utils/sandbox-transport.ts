import { Cause, Clock, Effect, Exit, Schema } from "effect";
import {
  FetchHttpClient,
  Headers,
  HttpClient,
  HttpClientRequest,
} from "effect/http";

import {
  SANDBOX_CLEANUP_TIMEOUT_MS,
  SANDBOX_ERROR_RESPONSE_BYTES,
  SANDBOX_ERROR_RESPONSE_TIMEOUT_MS,
  SANDBOX_MAX_RESPONSE_BYTES,
  SANDBOX_REQUEST_TIMEOUT_MS,
} from "../constants/sandbox";
import { SandboxRequestError } from "../errors/sandbox";
import { sandboxAllocationSchema } from "../schemas/sandbox";
import { boundBuildLog } from "./bound-build-log";
import { redactBuildLog } from "./build-log";
import { boxApiUrl } from "./provider-urls";
import { readBodyUpToEffect } from "./read-body";

export const sandboxRequestEffect = Effect.fn("Sites.Sandbox.request")(
  function* (
    apiKey: string,
    operation: string,
    path: string,
    method: "GET" | "POST" | "DELETE",
    body?: string | FormData,
    maxBytes = SANDBOX_MAX_RESPONSE_BYTES,
    timeoutMs = SANDBOX_REQUEST_TIMEOUT_MS,
    onLateAllocation?: (
      id: string | null,
      cleaned: boolean,
      diagnostic?: string
    ) => void
  ) {
    const deadline = (yield* Clock.currentTimeMillis) + timeoutMs;
    const transport = yield* FetchHttpClient.Fetch;
    const redactedHeaders = yield* Headers.CurrentRedactedNames;
    const client = HttpClient.withScope(yield* HttpClient.HttpClient);
    let fetched: Response | undefined;
    let status: number | null = null;
    const failure = (message: string) =>
      new SandboxRequestError({ operation, status, message });
    const timedOut = () =>
      Effect.fail(
        new SandboxRequestError({
          operation,
          status: null,
          message: `Sandbox ${operation} timed out`,
        })
      );
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        void fetched?.body?.cancel().catch(() => undefined);
      })
    );
    let request = HttpClientRequest.make(method)(
      `${boxApiUrl()}/v2/box/${path}`
    ).pipe(HttpClientRequest.setHeader("X-Box-Api-Key", apiKey));
    if (typeof body === "string") {
      request = HttpClientRequest.bodyText(request, body, "application/json");
    } else if (body) {
      request = HttpClientRequest.bodyFormData(request, body);
    }
    const response = yield* client.execute(request).pipe(
      Effect.provideService(Headers.CurrentRedactedNames, [
        ...redactedHeaders,
        "x-box-api-key",
      ]),
      Effect.provideService(FetchHttpClient.Fetch, async (input, init) => {
        try {
          const result = await transport(input, init);
          fetched = result;
          if (init?.signal?.aborted && onLateAllocation && result.ok) {
            let lateId: string | null = null;
            const recover = Effect.gen(function* () {
              const capped = yield* readBodyUpToEffect(
                result,
                SANDBOX_MAX_RESPONSE_BYTES
              );
              if (capped.exceeded) {
                return yield* Effect.fail(
                  failure("Late allocation response exceeds its size limit")
                );
              }
              const allocation = yield* Schema.decodeUnknownEffect(
                Schema.fromJsonString(sandboxAllocationSchema)
              )(new TextDecoder().decode(capped.bytes));
              lateId = allocation.id;
              const cleaned = yield* sandboxRequestEffect(
                apiKey,
                "cleanup",
                encodeURIComponent(allocation.id),
                "DELETE",
                undefined,
                SANDBOX_MAX_RESPONSE_BYTES,
                SANDBOX_CLEANUP_TIMEOUT_MS
              ).pipe(
                Effect.match({ onFailure: () => false, onSuccess: () => true })
              );
              onLateAllocation(allocation.id, cleaned);
            }).pipe(
              Effect.scoped,
              Effect.timeout(SANDBOX_CLEANUP_TIMEOUT_MS * 2),
              Effect.onExit((exit) =>
                Effect.sync(() => {
                  void result.body?.cancel().catch(() => undefined);
                  if (Exit.isFailure(exit)) {
                    onLateAllocation(
                      lateId,
                      false,
                      Cause.hasInterrupts(exit.cause)
                        ? "Late sandbox recovery was interrupted; its TTL still applies"
                        : "Late sandbox recovery failed; its TTL still applies"
                    );
                  }
                })
              )
            );
            void Effect.runPromiseExit(recover);
          } else if (init?.signal?.aborted) {
            void result.body?.cancel().catch(() => undefined);
          }
          return result;
        } catch (error) {
          throw failure(
            boundBuildLog(
              redactBuildLog(
                error instanceof Error
                  ? error.message
                  : "Sandbox request failed",
                [apiKey]
              )
            )
          );
        }
      }),
      Effect.mapError((error) =>
        failure(
          error.reason._tag === "TransportError" &&
            error.reason.cause instanceof SandboxRequestError
            ? error.reason.cause.message
            : "Sandbox request failed"
        )
      ),
      Effect.interruptible,
      Effect.timeoutOrElse({ duration: timeoutMs, orElse: timedOut })
    );
    status = response.status;
    const remainingMs = Math.max(
      0,
      deadline - (yield* Clock.currentTimeMillis)
    );
    if (status < 200 || status >= 300) {
      const requestId = redactBuildLog(
        fetched?.headers.get("x-request-id") ??
          fetched?.headers.get("x-upstash-request-id") ??
          "",
        [apiKey]
      ).slice(0, SANDBOX_ERROR_RESPONSE_BYTES);
      const capped = fetched
        ? yield* readBodyUpToEffect(fetched, SANDBOX_ERROR_RESPONSE_BYTES).pipe(
            Effect.interruptible,
            Effect.timeoutOrElse({
              duration: Math.min(
                SANDBOX_ERROR_RESPONSE_TIMEOUT_MS,
                remainingMs
              ),
              orElse: () => Effect.succeed(null),
            }),
            Effect.catch(() => Effect.succeed(null))
          )
        : null;
      let responseBody =
        capped === null && fetched
          ? "[Provider error response could not be read]"
          : "";
      if (capped?.exceeded) {
        responseBody =
          "[Provider error response exceeds diagnostic size limit]";
      } else if (capped) {
        responseBody = redactBuildLog(new TextDecoder().decode(capped.bytes), [
          apiKey,
        ])
          .trim()
          .slice(0, SANDBOX_ERROR_RESPONSE_BYTES);
      }
      const summary = `Sandbox rejected ${operation} (${status})`;
      return yield* Effect.fail(
        new SandboxRequestError({
          operation,
          status,
          message: `${summary}${requestId ? ` [request ID: ${requestId}]` : ""}${responseBody ? `: ${responseBody}` : ""}`,
          responseBody: responseBody || undefined,
          requestId: requestId || undefined,
        })
      );
    }
    if (!fetched) {
      return yield* Effect.fail(failure("Sandbox response is unavailable"));
    }
    const length = Number(fetched.headers.get("content-length") ?? 0);
    if (length > maxBytes) {
      return yield* Effect.fail(
        failure(`${path} is larger than allowed (${length} bytes)`)
      );
    }
    const capped = yield* readBodyUpToEffect(fetched, maxBytes).pipe(
      Effect.mapError(() => failure("Sandbox response could not be read")),
      Effect.interruptible,
      Effect.timeoutOrElse({ duration: remainingMs, orElse: timedOut })
    );
    if (capped.exceeded) {
      return yield* Effect.fail(
        failure(`${path} is larger than allowed (${maxBytes} bytes)`)
      );
    }
    return capped.bytes;
  },
  (program) =>
    program.pipe(
      Effect.scoped,
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch)
    )
);

export const sandboxJsonEffect = Effect.fn("Sites.Sandbox.decode")(function* <
  A,
  I,
>(bytes: Uint8Array, schema: Schema.Codec<A, I>, operation: string) {
  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(
    new TextDecoder().decode(bytes)
  ).pipe(
    Effect.mapError(
      () =>
        new SandboxRequestError({
          operation,
          status: null,
          message: `Sandbox returned an invalid ${operation} response`,
        })
    )
  );
});

export function isRejectedBeforeExecution(error: unknown): boolean {
  return (
    error instanceof SandboxRequestError &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500
  );
}
