import { getRouteMetadata } from "@notra/ai/gateway";
import { fromVercelServedModelId } from "@notra/ai/router/model-ids";
import {
  OgAccountingError,
  OgProviderError,
} from "@notra/ai/schemas/og-errors";
import type { OgDesignCall, OgDesignParams } from "@notra/ai/types/og-image";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import { generateText, NoObjectGeneratedError } from "ai";

/** Persist a started row before spending; an unmeasured failure never becomes $0. */
export async function generateOgModelCall(
  args: Parameters<typeof generateText>[0],
  stage: OgDesignCall["stage"],
  requestedModel: string,
  params: OgDesignParams
) {
  const call: OgDesignCall = {
    id: crypto.randomUUID(),
    stage,
    requestedModel,
    status: "running",
  };
  const record = async (next: OgDesignCall) => {
    try {
      await params.onCall?.(next);
    } catch (cause) {
      throw new OgAccountingError({ cause });
    }
  };
  const complete = async (next: OgDesignCall) => {
    const outcomes = await Promise.allSettled([
      record(next),
      Promise.resolve().then(() => {
        if (next.usage) {
          params.onUsage?.(next.usage);
        }
      }),
    ]);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        throw new OgAccountingError({ cause: outcome.reason });
      }
    }
  };
  await record(call);
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    // Do not stack SDK retries on the router's bounded gateway fallback.
    result = await generateText({ ...args, maxRetries: 0 });
  } catch (error) {
    const usage =
      NoObjectGeneratedError.isInstance(error) && error.usage
        ? {
            ...toAgentTokenUsage(error.usage),
            modelId: error.response?.modelId
              ? fromVercelServedModelId(error.response.modelId)
              : requestedModel,
          }
        : undefined;
    await complete({
      ...call,
      status: args.abortSignal?.aborted ? "aborted" : "failed",
      usage,
      error: error instanceof Error ? error.name : "Model call failed",
    });
    if (NoObjectGeneratedError.isInstance(error)) {
      throw error;
    }
    throw new OgProviderError({ cause: error });
  }
  const route = getRouteMetadata(result.providerMetadata);
  const usage = {
    ...toAgentTokenUsage(result.totalUsage),
    modelId: route?.model ?? fromVercelServedModelId(result.response.modelId),
    route,
  };
  await complete({ ...call, status: "completed", usage });
  return result;
}
