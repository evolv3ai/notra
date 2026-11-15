import { runBackgroundGen } from "@notra/ai/agents/background-gen";
import { CONTENT_AGENT_PROFILES } from "@notra/ai/constants/content-agents";
import type {
  LinkedInAgentOptions,
  LinkedInAgentResult,
} from "@notra/ai/types/agents";

export async function generateLinkedInPost(
  options: LinkedInAgentOptions
): Promise<LinkedInAgentResult> {
  return runBackgroundGen({
    ...options,
    ...CONTENT_AGENT_PROFILES.linkedin_post,
  });
}
