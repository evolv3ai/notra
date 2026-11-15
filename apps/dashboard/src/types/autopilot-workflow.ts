import type { AgentTokenUsage } from "@notra/ai/types/agents";
import type { GitHubMentionBillingReservation } from "@notra/ai/types/billing";
import type {
  WorkflowBlockContext,
  WorkflowBlockStepContext,
} from "@notra/workflows/types/blocks";
import type { WorkflowNodeOutcome } from "@notra/workflows/types/run";
import type * as z from "zod";

import type { renderBlogDraftHeroImage } from "@/lib/autopilot/blog";
import type { writeReadinessFix } from "@/lib/autopilot/readiness";
import type {
  autopilotRunConfigSchema,
  finishConfigSchema,
  gatherConfigSchema,
  proposalConfigSchema,
} from "@/schemas/autopilot-workflow";
import type { AutopilotJobResult } from "@/types/autopilot";
import type {
  AutopilotBlogDraft,
  AutopilotObservationJob,
  AutopilotReadinessCheck,
  FindingClaim,
} from "@/types/autopilot-runtime";

export type AutopilotBlockContext = WorkflowBlockContext<
  z.output<typeof autopilotRunConfigSchema>
>;

export type WorkflowBlockFinalizerContext = WorkflowBlockStepContext<
  z.output<typeof autopilotRunConfigSchema>,
  {
    claim: FindingClaim;
    reservation: GitHubMentionBillingReservation;
    usage: (AgentTokenUsage | null)[];
  }
> & { outcome: WorkflowNodeOutcome };

export type ProposalConfig = z.output<typeof proposalConfigSchema>;
export type GatherConfig = z.output<typeof gatherConfigSchema>;
export type FinishConfig = z.output<typeof finishConfigSchema>;
export type GatherState = Record<AutopilotObservationJob, AutopilotJobResult>;

export interface FinishState extends Record<string, unknown> {
  slackMessageTs: string | null;
}

export interface IdeaState extends Record<string, unknown> {
  claim: FindingClaim;
}

export interface PostState extends Record<string, unknown> {
  claim: FindingClaim;
  reservation: GitHubMentionBillingReservation;
  draft: AutopilotBlogDraft;
  hero: Awaited<ReturnType<typeof renderBlogDraftHeroImage>>;
  usage: (AgentTokenUsage | null)[];
}

export interface ReadinessState extends Record<string, unknown> {
  check: Extract<AutopilotReadinessCheck, { ready: true }>;
  claim: FindingClaim;
  reservation: GitHubMentionBillingReservation;
  fix: Awaited<ReturnType<typeof writeReadinessFix>>;
  usage: (AgentTokenUsage | null)[];
}
