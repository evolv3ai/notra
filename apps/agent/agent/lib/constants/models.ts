export const ASSISTANT_MODEL_ID = "anthropic/claude-sonnet-5.5";
export const ASSISTANT_FAST_MODEL_ID = "openai/gpt-6-luna";
export const ASSISTANT_DEEP_MODEL_ID = "anthropic/claude-opus-5.5";
export const ASSISTANT_TASK_MODEL_ID = "openai/gpt-6-sol";
export const IMAGE_DESIGNER_MODEL_ID = "anthropic/claude-sonnet-5.5";
export const CONTENT_WRITER_MODEL_ID = "openai/gpt-6-sol";
export const GPT_6_SOL_CONTEXT_WINDOW_TOKENS = 1_050_000;
export const SONNET_5_CONTEXT_WINDOW_TOKENS = 1_000_000;

export const ASSISTANT_MODEL_TIERS: readonly string[] = [
  ASSISTANT_FAST_MODEL_ID,
  ASSISTANT_MODEL_ID,
  ASSISTANT_DEEP_MODEL_ID,
];

export const ASSISTANT_AUTO_MODEL_OPTIONS = {
  [ASSISTANT_FAST_MODEL_ID]: {
    description:
      "Short, routine turns the assistant answers from general knowledge alone: greetings, acknowledgements, and quick factual or conceptual questions about marketing, writing or software in general. Never pick this when the turn is about the user's own posts, metrics, GEO results, website traffic, repositories or issues, however short the question is",
    reasoning: "low",
  },
  [ASSISTANT_MODEL_ID]: {
    description:
      "Any turn that changes or inspects the user's own content or connected data: editing a draft, writing or rewriting a post, reading GitHub, Linear or analytics data, publishing, scheduling, or any other tool use",
    reasoning: "low",
  },
  [ASSISTANT_DEEP_MODEL_ID]: {
    description:
      "Demanding turns: long-form writing of roughly a thousand words or more, multi-source research across commits, issues or releases, competitive or strategic analysis, planning a whole content calendar, or nuanced critique and architectural trade-off discussions",
    reasoning: "high",
  },
} as const;

export const AUTO_MODEL_FLAG_ENV = "NOTRA_JEV_CLASSIFIERS";
