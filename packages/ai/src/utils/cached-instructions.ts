import type { SystemModelMessage } from "ai";

export function cachedInstructions(
  shared: string,
  context: string
): SystemModelMessage[] {
  // A separate breakpoint lets new sessions reuse rules without workspace data.
  return [
    {
      role: "system",
      content: shared.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
        openrouter: { cacheControl: { type: "ephemeral" } },
      },
    },
    { role: "system", content: context.trim() },
  ];
}
