export const CODING_AGENT_TARGETS = [
  ["opencode/gpt-6-astra", "opencode"],
  ["opencode/gpt-6-luna", "opencode"],
  ["opencode/gpt-6.1-sol-medium", "opencode"],
  ["opencode/claude-sonnet-5.5", "opencode"],
  ["opencode/claude-opus-5.5", "opencode"],
  ["claude-code/claude-sonnet-5.5", "claude-code"],
  ["claude-code/claude-opus-5.5", "claude-code"],
  ["claude-code/claude-fable-5.1", "claude-code"],
  ["codex/gpt-6.1-sol", "codex"],
  ["codex/gpt-6-luna", "codex"],
  ["codex/gpt-6-astra", "codex"],
] as const;

export const CODING_AGENT_USAGE = {
  modelId: "openai/gpt-5.6-sol",
  inputTokens: 100,
  inputTokenDetails: {
    noCacheTokens: 70,
    cacheReadTokens: 20,
    cacheWriteTokens: 10,
  },
  outputTokens: 40,
  outputTokenDetails: { textTokens: 25, reasoningTokens: 15 },
  totalTokens: 140,
  totalUsd: 0.25,
  computeMs: 1200,
};
