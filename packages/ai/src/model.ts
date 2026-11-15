import { gateway } from "@notra/ai/gateway";
import {
  type AILogTarget,
  wrapModelWithObservability,
} from "@notra/ai/observability";
import type { GatewayArgs, GatewayResult } from "@notra/ai/types/gateway";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";

type DevToolsMiddleware =
  (typeof import("@ai-sdk/devtools"))["devToolsMiddleware"];

export function createModel(
  organizationId: string | undefined,
  modelId: GatewayArgs[0],
  log?: AILogTarget
): GatewayResult {
  const base = gateway(modelId, { organizationId });
  return wrapModelForDevTools(wrapModelWithObservability(base, log));
}

function wrapModelForDevTools(model: GatewayResult): GatewayResult {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.AI_SDK_DEVTOOLS !== "true"
  ) {
    return model;
  }

  return wrapLanguageModel({
    model,
    middleware: createLazyDevToolsMiddleware(),
  }) as GatewayResult;
}

function createLazyDevToolsMiddleware(): LanguageModelMiddleware {
  let middlewarePromise: Promise<LanguageModelMiddleware> | undefined;

  const getMiddleware = () => {
    middlewarePromise ??= import("@ai-sdk/devtools").then(
      ({ devToolsMiddleware }: { devToolsMiddleware: DevToolsMiddleware }) =>
        devToolsMiddleware()
    );
    return middlewarePromise;
  };

  return {
    specificationVersion: "v4",
    async transformParams(options) {
      const middleware = await getMiddleware();
      return middleware.transformParams
        ? middleware.transformParams(options)
        : options.params;
    },
    async wrapGenerate(options) {
      const middleware = await getMiddleware();
      return middleware.wrapGenerate
        ? middleware.wrapGenerate(options)
        : options.doGenerate();
    },
    async wrapStream(options) {
      const middleware = await getMiddleware();
      return middleware.wrapStream
        ? middleware.wrapStream(options)
        : options.doStream();
    },
  };
}
