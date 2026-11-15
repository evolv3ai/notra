import {
  GEO_FX_HARNESS_PATH,
  GEO_FX_HARNESS_SOURCE,
  GEO_FX_INSTALL_COMMAND,
  GEO_FX_USAGE_TOOL_ID,
} from "@notra/ai/constants/geo-fx";
import {
  GEO_BOX_GATEWAY_API_KEY_ENV,
  GEO_CLAUDE_CODE_EFFORT,
  GEO_CODEX_REASONING_EFFORT,
  GEO_CODEX_WEB_SEARCH,
  GEO_OPENCODE_BOX_API_KEY_ENV,
  GEO_OPENCODE_BOX_MODEL_ID,
  GEO_OPENCODE_REASONING_EFFORT,
  GEO_OPENCODE_RUN_TIMEOUT_MS,
  GEO_OPENCODE_SOURCE_LIMIT,
} from "@notra/ai/constants/geo-opencode";
import { geoFxUsageSchema } from "@notra/ai/schemas/geo-fx";
import type {
  GeoFxConversationMessage,
  GeoFxUsage,
} from "@notra/ai/types/geo-fx";
import type {
  GeoBoxAnswer,
  GeoBoxHarness,
  GeoBoxTokenUsage,
} from "@notra/ai/types/geo-opencode";
import { awaitGeoBoxOperation } from "@notra/ai/utils/geo-box-operation";
import { geoFxTokenUsage } from "@notra/ai/utils/geo-fx-usage";
import {
  createGeoOpenCodeBoxName,
  createGeoOpenCodeBox,
  deleteGeoOpenCodeBox,
} from "@notra/ai/utils/geo-opencode-box";
import { extractHttpUrls } from "@notra/ai/utils/geo-opencode-sources";
import { geoBoxTokenUsage } from "@notra/ai/utils/geo-opencode-usage";
import { requireApiKey } from "@notra/utils/require-api-key";
import type {
  Chunk,
  ClaudeCodeAgentOptions,
  CodexAgentOptions,
  OpenCodeAgentOptions,
  StreamRun,
} from "@upstash/box";
import { Agent, Box, BoxError } from "@upstash/box";

function boxAgentFromHarness(harness: GeoBoxHarness | undefined): Agent {
  if (harness === "fx") {
    return Agent.Custom;
  }
  if (harness === "claude-code") {
    return Agent.ClaudeCode;
  }
  if (harness === "codex") {
    return Agent.Codex;
  }
  return Agent.OpenCode;
}

function boxStreamOptions(agent: Agent) {
  if (agent === Agent.Custom) {
    return {};
  }
  if (agent === Agent.ClaudeCode) {
    return { effort: GEO_CLAUDE_CODE_EFFORT } satisfies ClaudeCodeAgentOptions;
  }
  if (agent === Agent.Codex) {
    return {
      modelReasoningEffort: GEO_CODEX_REASONING_EFFORT,
      webSearch: GEO_CODEX_WEB_SEARCH,
    } satisfies CodexAgentOptions;
  }
  return {
    reasoningEffort: GEO_OPENCODE_REASONING_EFFORT,
    textVerbosity: "medium",
  } satisfies OpenCodeAgentOptions;
}

function abortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("OpenCode conversation was cancelled");
}

function remainingRunTimeout(deadlineAtMs?: number) {
  if (deadlineAtMs === undefined) {
    return GEO_OPENCODE_RUN_TIMEOUT_MS;
  }
  const remainingMs = deadlineAtMs - Date.now();
  if (remainingMs <= 0) {
    throw new DOMException("The operation timed out", "TimeoutError");
  }
  return Math.min(GEO_OPENCODE_RUN_TIMEOUT_MS, remainingMs);
}

function operationSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort(
      new DOMException("The operation timed out", "TimeoutError")
    );
  }, timeoutMs);
  return {
    signal: signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal,
    dispose: () => clearTimeout(timeout),
  };
}

async function consumeGeoOpenCodeStream(
  streamPromise: Promise<StreamRun<string, Chunk>>,
  signal?: AbortSignal
) {
  const consume = async () => {
    const stream = await streamPromise;
    let finished = false;
    for await (const chunk of stream) {
      if (chunk.type === "finish") {
        finished = true;
      }
    }
    if (!finished) {
      throw new BoxError("Box agent stream ended without a finish event");
    }
    return stream;
  };

  return awaitGeoBoxOperation(consume(), signal);
}

async function runGeoOpenCodePrompt(
  box: Box,
  prompt: string,
  agent: Agent,
  model: string,
  signal?: AbortSignal,
  deadlineAtMs?: number,
  onUsage?: (usage: GeoBoxTokenUsage) => void
) {
  const sourceUrls = new Set<string>();
  const toolCalls: unknown[] = [];
  let fxUsage: GeoFxUsage | undefined;
  const collectSources = (value: unknown) => {
    for (const url of extractHttpUrls(value)) {
      if (sourceUrls.size >= GEO_OPENCODE_SOURCE_LIMIT) {
        break;
      }
      sourceUrls.add(url);
    }
  };

  const operation = operationSignal(signal, remainingRunTimeout(deadlineAtMs));
  try {
    if (operation.signal.aborted) {
      throw abortReason(operation.signal);
    }
    const stream = await consumeGeoOpenCodeStream(
      box.agent.stream({
        prompt:
          agent === Agent.Custom
            ? JSON.stringify({
                kind: "notra_fx_prompt",
                prompt,
                timeoutMs: Math.max(
                  1,
                  remainingRunTimeout(deadlineAtMs) - 2000
                ),
              })
            : prompt,
        options: boxStreamOptions(agent),
        onToolUse: (tool) => {
          toolCalls.push(tool);
          collectSources(tool.input);
        },
        onToolResult: ({ output, toolCallId }) => {
          if (agent === Agent.Custom && toolCallId === GEO_FX_USAGE_TOOL_ID) {
            const parsed = geoFxUsageSchema.safeParse(output);
            if (parsed.success && parsed.data.usage.modelId === model) {
              fxUsage = parsed.data;
              onUsage?.(geoFxTokenUsage(parsed.data));
            }
            return;
          }
          collectSources(output);
        },
      }),
      operation.signal
    );
    if (operation.signal.aborted) {
      throw abortReason(operation.signal);
    }

    if (agent === Agent.Custom && !fxUsage?.verified) {
      throw new BoxError("fx returned no verified answer or usage");
    }
    const text = stream.result.trim();
    return {
      text,
      sources: extractHttpUrls(text)
        .slice(0, GEO_OPENCODE_SOURCE_LIMIT)
        .map((url) => ({ url, title: null })),
      groundingSources: [...sourceUrls].map((url) => ({ url, title: null })),
      toolCalls,
      usage: fxUsage
        ? geoFxTokenUsage(fxUsage, stream.cost.computeMs)
        : geoBoxTokenUsage(
            stream.cost,
            model,
            agent === Agent.ClaudeCode ? "claude-code" : "opencode"
          ),
    };
  } catch (error) {
    if (operation.signal.aborted) {
      throw abortReason(operation.signal);
    }
    if (fxUsage?.timedOut) {
      throw new DOMException("The fx operation timed out", "TimeoutError");
    }
    throw error;
  } finally {
    operation.dispose();
  }
}

export async function askGeoOpenCodeConversation(
  prompts: readonly string[],
  signal?: AbortSignal,
  deadlineAtMs?: number,
  model = GEO_OPENCODE_BOX_MODEL_ID,
  harness: GeoBoxHarness = "opencode",
  onResult?: (result: GeoBoxAnswer) => void,
  onUsage?: (usage: GeoBoxTokenUsage) => void
) {
  if (prompts.length === 0) {
    return [];
  }
  if (signal?.aborted) {
    throw abortReason(signal);
  }
  const agent = boxAgentFromHarness(harness);
  const boxApiKey = requireApiKey(GEO_OPENCODE_BOX_API_KEY_ENV);
  const modelApiKey = requireApiKey(GEO_BOX_GATEWAY_API_KEY_ENV);
  const boxName = createGeoOpenCodeBoxName();
  const createTimeoutMs = remainingRunTimeout(deadlineAtMs);
  const createOperation = operationSignal(signal, createTimeoutMs);
  let box: Box;
  try {
    box = await createGeoOpenCodeBox(
      boxName,
      boxApiKey,
      modelApiKey,
      createOperation.signal,
      createTimeoutMs,
      model,
      agent
    );
  } finally {
    createOperation.dispose();
  }

  const results: Awaited<ReturnType<typeof runGeoOpenCodePrompt>>[] = [];
  let previousSessionUsd = 0;
  let previousSessionCostWasValid = true;
  let operationFailed = false;
  let operationError: unknown;
  try {
    if (agent === Agent.Custom) {
      const bootstrap = operationSignal(
        signal,
        remainingRunTimeout(deadlineAtMs)
      );
      try {
        if (bootstrap.signal.aborted) {
          throw abortReason(bootstrap.signal);
        }
        const installation = await awaitGeoBoxOperation(
          box.exec.command(GEO_FX_INSTALL_COMMAND),
          bootstrap.signal
        );
        if (
          installation.status !== "completed" ||
          installation.exitCode !== 0
        ) {
          throw new BoxError("fx installation failed");
        }
        await awaitGeoBoxOperation(
          box.files.write({
            path: GEO_FX_HARNESS_PATH.replace("/workspace/home/", ""),
            content: GEO_FX_HARNESS_SOURCE,
          }),
          bootstrap.signal
        );
      } finally {
        bootstrap.dispose();
      }
    }
    const transcript: GeoFxConversationMessage[] = [];
    for (const prompt of prompts) {
      const result = await runGeoOpenCodePrompt(
        box,
        agent === Agent.Custom && transcript.length > 0
          ? `Previous conversation (use as context):\n${JSON.stringify(transcript)}\n\nCurrent question:\n${prompt}`
          : prompt,
        agent,
        model,
        signal,
        deadlineAtMs,
        onUsage
      );
      if (agent === Agent.ClaudeCode) {
        const sessionUsd = result.usage.totalUsd;
        const validSessionCost =
          sessionUsd !== undefined && sessionUsd >= previousSessionUsd;
        result.usage.totalUsd =
          validSessionCost && previousSessionCostWasValid
            ? sessionUsd - previousSessionUsd
            : undefined;
        if (validSessionCost) {
          previousSessionUsd = sessionUsd;
        }
        previousSessionCostWasValid = validSessionCost;
      }
      results.push(result);
      onResult?.(result);
      if (!result.text) {
        throw new BoxError("Box agent returned no result");
      }
      if (agent === Agent.Custom) {
        transcript.push(
          { role: "user", content: prompt },
          { role: "assistant", content: result.text }
        );
      }
    }
    if (signal?.aborted) {
      throw abortReason(signal);
    }
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await deleteGeoOpenCodeBox(box.id, boxApiKey);
  } catch (error) {
    cleanupFailed = true;
    cleanupError = error;
  }
  if (operationFailed) {
    if (cleanupFailed) {
      throw new AggregateError(
        [operationError, cleanupError],
        "Box agent run and box cleanup failed"
      );
    }
    throw operationError;
  }
  if (cleanupFailed) {
    throw cleanupError;
  }
  return results;
}

export async function askGeoOpenCode(
  prompt: string,
  signal?: AbortSignal,
  deadlineAtMs?: number,
  model = GEO_OPENCODE_BOX_MODEL_ID,
  harness: GeoBoxHarness = "opencode",
  onResult?: (result: GeoBoxAnswer) => void,
  onUsage?: (usage: GeoBoxTokenUsage) => void
) {
  const [result] = await askGeoOpenCodeConversation(
    [prompt],
    signal,
    deadlineAtMs,
    model,
    harness,
    onResult,
    onUsage
  );
  if (!result) {
    throw new Error("Box agent returned no result");
  }
  return result;
}
