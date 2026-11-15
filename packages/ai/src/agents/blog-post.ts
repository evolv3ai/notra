import { runBackgroundGen } from "@notra/ai/agents/background-gen";
import { CONTENT_AGENT_PROFILES } from "@notra/ai/constants/content-agents";
import type {
  BlogPostAgentOptions,
  BlogPostAgentResult,
} from "@notra/ai/types/agents";

export async function generateBlogPost(
  options: BlogPostAgentOptions
): Promise<BlogPostAgentResult> {
  return runBackgroundGen({
    ...options,
    ...CONTENT_AGENT_PROFILES.blog_post,
  });
}
