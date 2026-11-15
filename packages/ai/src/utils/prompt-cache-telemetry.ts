import { createHash } from "node:crypto";

import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";

export function promptCacheTelemetry({
  prompt,
  tools,
}: Pick<LanguageModelV4CallOptions, "prompt" | "tools">) {
  const firstSystem = prompt[0]?.role === "system" ? prompt[0] : undefined;
  return {
    promptMessageCount: prompt.length,
    assistantMessageCount: prompt.filter(
      (message) => message.role === "assistant"
    ).length,
    firstSystemMessageHash: firstSystem
      ? createHash("sha256").update(JSON.stringify(firstSystem)).digest("hex")
      : undefined,
    toolDefinitionsHash: createHash("sha256")
      .update(JSON.stringify(tools ?? []))
      .digest("hex"),
  };
}
