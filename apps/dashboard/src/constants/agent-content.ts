import { CONTENT_AGENT_PROFILES } from "@notra/ai/constants/content-agents";
import type { ContentType } from "@notra/ai/schemas/content";

export interface AgentContentTaskType {
  contentType: ContentType;
  contentLabel: string;
  brandAgentType: string;
}

export const AGENT_CONTENT_TASK_TYPES: Record<
  string,
  AgentContentTaskType | undefined
> = CONTENT_AGENT_PROFILES;
