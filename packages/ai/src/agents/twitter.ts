import { runBackgroundGen } from "@notra/ai/agents/background-gen";
import { CONTENT_AGENT_PROFILES } from "@notra/ai/constants/content-agents";
import type {
  TwitterAgentOptions,
  TwitterAgentResult,
} from "@notra/ai/types/agents";

export async function generateTwitterPost(
  options: TwitterAgentOptions
): Promise<TwitterAgentResult> {
  return runBackgroundGen({
    ...options,
    ...CONTENT_AGENT_PROFILES.twitter_post,
  });
}
