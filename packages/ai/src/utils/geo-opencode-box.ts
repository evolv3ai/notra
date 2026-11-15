import { GEO_FX_HARNESS_PATH } from "@notra/ai/constants/geo-fx";
import {
  GEO_OPENCODE_BOX_API_BASE_URL,
  GEO_OPENCODE_BOX_DELETE_ATTEMPTS,
  GEO_OPENCODE_BOX_MANAGEMENT_TIMEOUT_MS,
  GEO_OPENCODE_BOX_MODEL_ID,
  GEO_OPENCODE_BOX_NAME_PREFIX,
  GEO_OPENCODE_BOX_POLL_INTERVAL_MS,
  GEO_OPENCODE_BOX_RECOVERY_ATTEMPTS,
  GEO_OPENCODE_BOX_RECOVERY_TIMEOUT_MS,
  GEO_OPENCODE_BOX_RETRY_DELAY_MS,
  GEO_OPENCODE_MILLISECONDS_PER_SECOND,
  GEO_OPENCODE_MILLISECOND_TIMESTAMP_MINIMUM,
  GEO_OPENCODE_STALE_BOX_AGE_MS,
} from "@notra/ai/constants/geo-opencode";
import type {
  GeoOpenCodeBoxRetryOptions,
  GeoOpenCodeStaleBoxCandidate,
} from "@notra/ai/types/geo-opencode";
import {
  isTransientBoxNetworkError,
  linearRetrySchedule,
  runBoxEffect,
} from "@notra/ai/utils/box-retry";
import { Agent, Box, BoxError, type BoxData } from "@upstash/box";
import { Duration, Effect, Schedule } from "effect";

function isNotFoundBoxError(error: unknown) {
  return error instanceof BoxError && error.statusCode === 404;
}

function isRetryableBoxError(error: unknown) {
  if (error instanceof BoxError && error.statusCode !== undefined) {
    return (
      error.statusCode === 408 ||
      error.statusCode === 429 ||
      error.statusCode >= 500
    );
  }
  return isTransientBoxNetworkError(error);
}

function abortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("OpenCode box operation was cancelled");
}

/**
 * Bounds a management call (including its retry backoff) by `timeoutMs`. The
 * pending request's signal is aborted when the deadline passes.
 */
function withGeoOpenCodeBoxDeadline<T>(
  effect: Effect.Effect<T, unknown>,
  timeoutMs: number
) {
  return effect.pipe(
    Effect.timeoutOrElse({
      duration: Duration.millis(timeoutMs),
      orElse: () =>
        Effect.fail(
          new DOMException("The box operation timed out", "TimeoutError")
        ),
    })
  );
}

export async function geoOpenCodeBoxErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // Fall through to the status-only error used by the SDK.
  }
  return `Request failed with status ${response.status}`;
}

async function requestGeoOpenCodeBoxApi(
  path: string,
  apiKey: string,
  signal: AbortSignal,
  init: { method?: string; body?: string } = {}
) {
  const response = await fetch(`${GEO_OPENCODE_BOX_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      "X-Box-Api-Key": apiKey,
    },
    signal,
  });
  if (!response.ok) {
    throw new BoxError(
      await geoOpenCodeBoxErrorMessage(response),
      response.status
    );
  }
  return response;
}

async function getGeoOpenCodeBoxByName(
  name: string,
  apiKey: string,
  signal: AbortSignal
) {
  const response = await requestGeoOpenCodeBoxApi(
    `/v2/box/${encodeURIComponent(name)}`,
    apiKey,
    signal
  );
  return (await response.json()) as BoxData;
}

async function listGeoOpenCodeBoxes(apiKey: string, signal: AbortSignal) {
  const response = await requestGeoOpenCodeBoxApi("/v2/box", apiKey, signal);
  return (await response.json()) as BoxData[];
}

async function requestGeoOpenCodeBoxDeletion(
  boxId: string,
  apiKey: string,
  signal: AbortSignal
) {
  await requestGeoOpenCodeBoxApi("/v2/box", apiKey, signal, {
    method: "DELETE",
    body: JSON.stringify({ ids: [boxId] }),
  });
}

/**
 * Polls a box until it leaves "creating", first after one interval and then
 * every interval. Not-found and transient poll errors keep waiting; any other
 * error stops the poll. Unbounded by design: the caller's signal is the
 * deadline.
 */
function pollGeoOpenCodeBoxCreation(
  boxId: string,
  headers: Record<string, string>,
  creating: BoxData
) {
  const poll = Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(
        `${GEO_OPENCODE_BOX_API_BASE_URL}/v2/box/${boxId}`,
        { headers, signal }
      );
      if (response.ok) {
        return (await response.json()) as BoxData;
      }
      const pollError = new BoxError(
        await geoOpenCodeBoxErrorMessage(response),
        response.status
      );
      if (!isRetryableBoxError(pollError) && !isNotFoundBoxError(pollError)) {
        throw pollError;
      }
      return creating;
    },
    catch: (cause) => cause,
  });
  return Effect.sleep(Duration.millis(GEO_OPENCODE_BOX_POLL_INTERVAL_MS)).pipe(
    Effect.andThen(
      poll.pipe(
        Effect.repeat({
          schedule: Schedule.spaced(
            Duration.millis(GEO_OPENCODE_BOX_POLL_INTERVAL_MS)
          ),
          while: (data) => data.status === "creating",
        })
      )
    )
  );
}

export async function createGeoOpenCodeBox(
  name: string,
  apiKey: string,
  modelApiKey: string,
  signal: AbortSignal,
  timeoutMs: number,
  model = GEO_OPENCODE_BOX_MODEL_ID,
  agent: Agent = Agent.OpenCode
) {
  if (signal.aborted) {
    throw abortReason(signal);
  }
  const headers = { "X-Box-Api-Key": apiKey };
  let boxId: string | undefined;
  let creationMayHaveSucceeded = true;
  try {
    const response = await fetch(`${GEO_OPENCODE_BOX_API_BASE_URL}/v2/box`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        runtime: "node",
        agent,
        // Box selects the model endpoint by prefix, independently of the key.
        model: agent === Agent.Custom ? model : `vercel/${model}`,
        ...(agent === Agent.Custom
          ? {
              custom_runner: {
                command: "node",
                args: [GEO_FX_HARNESS_PATH],
                protocol: "box-sse-v1",
              },
              attach_headers: {
                "ai-gateway.vercel.sh": {
                  Authorization: `Bearer ${modelApiKey}`,
                },
              },
            }
          : { agent_api_key: modelApiKey }),
      }),
      signal,
    });
    if (!response.ok) {
      creationMayHaveSucceeded =
        response.status === 408 || response.status >= 500;
      throw new BoxError(
        await geoOpenCodeBoxErrorMessage(response),
        response.status
      );
    }

    let data = (await response.json()) as BoxData;
    if (typeof data.id !== "string") {
      throw new BoxError("Box creation returned no box ID");
    }
    boxId = data.id;
    if (data.status === "creating") {
      data = await runBoxEffect(
        pollGeoOpenCodeBoxCreation(boxId, headers, data),
        signal,
        abortReason
      );
    }
    if (data.status === "error") {
      throw new BoxError("Box creation failed");
    }
    if (data.status !== "idle" && data.status !== "running") {
      throw new BoxError("Box creation returned an unexpected status");
    }
    if (signal.aborted) {
      throw abortReason(signal);
    }

    return new Box(data, {
      baseUrl: GEO_OPENCODE_BOX_API_BASE_URL,
      headers,
      timeout: timeoutMs,
      debug: false,
      isAgentConfigured: Boolean(data.agent),
    });
  } catch (createError) {
    if (!(boxId || creationMayHaveSucceeded)) {
      throw createError;
    }
    try {
      if (boxId) {
        await deleteGeoOpenCodeBox(boxId, apiKey);
      } else {
        await recoverAndDeleteGeoOpenCodeBox(name, apiKey);
      }
    } catch (cleanupError) {
      throw new AggregateError(
        [createError, cleanupError],
        "OpenCode box creation and recovery cleanup failed"
      );
    }
    throw createError;
  }
}

export function createGeoOpenCodeBoxName() {
  return `${GEO_OPENCODE_BOX_NAME_PREFIX}${crypto.randomUUID()}`;
}

/**
 * Retries `callback` with linear backoff (`retryDelayMs * n` before retry n).
 * The callback receives the attempt's signal, aborted when the surrounding
 * effect is interrupted (cancellation or a deadline).
 */
function retryGeoOpenCodeBoxEffect<T>(
  callback: (signal: AbortSignal) => Promise<T>,
  options: GeoOpenCodeBoxRetryOptions = {}
): Effect.Effect<T, unknown> {
  const attempts = options.attempts ?? GEO_OPENCODE_BOX_DELETE_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? GEO_OPENCODE_BOX_RETRY_DELAY_MS;
  const { signal } = options;
  const attempt = Effect.suspend(() =>
    signal?.aborted
      ? Effect.fail(abortReason(signal))
      : Effect.tryPromise({
          try: (attemptSignal) => callback(attemptSignal),
          catch: (cause) => cause,
        })
  );
  return attempt.pipe(
    Effect.retry({
      schedule: linearRetrySchedule(attempts, retryDelayMs),
      while: (error) =>
        signal?.aborted !== true &&
        (isRetryableBoxError(error) ||
          (options.retryNotFound === true && isNotFoundBoxError(error))),
    })
  );
}

export function withGeoOpenCodeBoxRetry<T>(
  callback: () => Promise<T>,
  options: GeoOpenCodeBoxRetryOptions = {}
): Promise<T> {
  return runBoxEffect(
    retryGeoOpenCodeBoxEffect(() => callback(), options),
    options.signal,
    abortReason
  );
}

export function deleteGeoOpenCodeBox(
  boxId: string,
  apiKey: string
): Promise<void> {
  return runBoxEffect(
    withGeoOpenCodeBoxDeadline(
      retryGeoOpenCodeBoxEffect((signal) =>
        requestGeoOpenCodeBoxDeletion(boxId, apiKey, signal)
      ),
      GEO_OPENCODE_BOX_MANAGEMENT_TIMEOUT_MS
    ).pipe(Effect.catchIf(isNotFoundBoxError, () => Effect.void)),
    undefined,
    abortReason
  );
}

export async function recoverAndDeleteGeoOpenCodeBox(
  name: string,
  apiKey: string
) {
  const box = await runBoxEffect(
    withGeoOpenCodeBoxDeadline(
      retryGeoOpenCodeBoxEffect(
        (signal) => getGeoOpenCodeBoxByName(name, apiKey, signal),
        {
          attempts: GEO_OPENCODE_BOX_RECOVERY_ATTEMPTS,
          retryNotFound: true,
        }
      ),
      GEO_OPENCODE_BOX_RECOVERY_TIMEOUT_MS
    ).pipe(Effect.catchIf(isNotFoundBoxError, () => Effect.succeed(null))),
    undefined,
    abortReason
  );
  if (!box) {
    return false;
  }
  await deleteGeoOpenCodeBox(box.id, apiKey);
  return true;
}

function timestampMilliseconds(timestamp: number) {
  return timestamp < GEO_OPENCODE_MILLISECOND_TIMESTAMP_MINIMUM
    ? timestamp * GEO_OPENCODE_MILLISECONDS_PER_SECOND
    : timestamp;
}

export function isStaleGeoOpenCodeBox(
  box: GeoOpenCodeStaleBoxCandidate,
  now = Date.now()
) {
  return (
    box.name?.startsWith(GEO_OPENCODE_BOX_NAME_PREFIX) === true &&
    now - timestampMilliseconds(box.created_at) >= GEO_OPENCODE_STALE_BOX_AGE_MS
  );
}

export async function deleteStaleGeoOpenCodeBoxIds(
  boxIds: readonly string[],
  deleteBox: (boxId: string) => Promise<void>
) {
  const errors: unknown[] = [];
  let deleted = 0;
  for (const boxId of boxIds) {
    try {
      await deleteBox(boxId);
      deleted += 1;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "Failed to delete stale OpenCode boxes");
  }
  return deleted;
}

export async function deleteStaleGeoOpenCodeBoxes() {
  const apiKey = process.env.UPSTASH_BOX_API_KEY?.trim();
  if (!apiKey) {
    return 0;
  }
  const boxes = await runBoxEffect(
    withGeoOpenCodeBoxDeadline(
      retryGeoOpenCodeBoxEffect((signal) =>
        listGeoOpenCodeBoxes(apiKey, signal)
      ),
      GEO_OPENCODE_BOX_MANAGEMENT_TIMEOUT_MS
    ),
    undefined,
    abortReason
  );
  const staleBoxes = boxes.filter((box) => isStaleGeoOpenCodeBox(box));
  return deleteStaleGeoOpenCodeBoxIds(
    staleBoxes.map((box) => box.id),
    (boxId) => deleteGeoOpenCodeBox(boxId, apiKey)
  );
}
