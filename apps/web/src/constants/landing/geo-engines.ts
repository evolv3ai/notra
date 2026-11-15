import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Gemini } from "@notra/ui/components/ui/svgs/gemini";
import { Grok } from "@notra/ui/components/ui/svgs/grok";
import { GrokDark } from "@notra/ui/components/ui/svgs/grokDark";
import { Kimi } from "@notra/ui/components/ui/svgs/kimi";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { OpenaiDark } from "@notra/ui/components/ui/svgs/openaiDark";
import { Perplexity } from "@notra/ui/components/ui/svgs/perplexity";
import { Zai } from "@notra/ui/components/ui/svgs/zai";

import type {
  EngineId,
  LandingEngineIcon,
  LandingEngineId,
} from "@/types/landing/geo";

export const GEO_ENGINE_NAMES: Record<EngineId, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  kimi: "Kimi",
};

export const LANDING_ENGINE_ICONS: Record<
  LandingEngineId,
  readonly [LandingEngineIcon] | readonly [LandingEngineIcon, LandingEngineIcon]
> = {
  chatgpt: [Openai, OpenaiDark],
  claude: [ClaudeAiIcon],
  "claude-code": [ClaudeAiIcon],
  gemini: [Gemini],
  perplexity: [Perplexity],
  grok: [Grok, GrokDark],
  kimi: [Kimi],
  glm: [Zai],
};
