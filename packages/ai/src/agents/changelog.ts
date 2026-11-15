import { runBackgroundGen } from "@notra/ai/agents/background-gen";
import { CONTENT_AGENT_PROFILES } from "@notra/ai/constants/content-agents";
import type {
  ChangelogAgentOptions,
  ChangelogAgentResult,
} from "@notra/ai/types/agents";

export async function generateChangelog(
  options: ChangelogAgentOptions
): Promise<ChangelogAgentResult> {
  return runBackgroundGen({
    ...options,
    ...CONTENT_AGENT_PROFILES.changelog,
  });
}
