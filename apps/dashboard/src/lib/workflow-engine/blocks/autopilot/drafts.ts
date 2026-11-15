import { createGitHubMentionUsageCollector } from "@notra/ai/billing/github-mention-billing";
import {
  defineWorkflowBlock,
  halt,
  next,
  requireStepState,
  succeed,
} from "@notra/workflows/runtime/registry";
import type { WorkflowBlockStep } from "@notra/workflows/types/blocks";

import { AUTOPILOT_TOPIC_ALREADY_TAKEN_MESSAGE as ALREADY_TAKEN } from "@/constants/autopilot-workflow";
import {
  draftFollowsRules,
  openBlogDraftPullRequest,
  renderBlogDraftHeroImage,
  writeBlogDraft,
} from "@/lib/autopilot/blog";
import {
  claimFinding,
  markFindingSuggested,
  reserveDraftSlot,
} from "@/lib/autopilot/findings";
import { withAutopilotFindingLease } from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { loadDecisionMemory } from "@/lib/autopilot/rules";
import { proposalConfigSchema } from "@/schemas/autopilot-workflow";
import type {
  IdeaState,
  PostState,
  ProposalConfig,
} from "@/types/autopilot-workflow";

import {
  actedOn,
  autopilotLogScope,
  holdAutopilotCredits,
  loadAutopilotContext,
  settleClaimedDraft,
  stepClaimToken,
} from "./shared";

const claimTopicStep: WorkflowBlockStep<ProposalConfig, IdeaState> = {
  id: "claim",
  title: "Claim the topic",
  run: async (context) => {
    const ctx = await loadAutopilotContext(context);
    const { proposal, brief, confidence } = context.config;
    const claim = await claimFinding(
      context.organizationId,
      ctx.runId,
      {
        ...proposal,
        evidence: { ...proposal.evidence, confidence, brief, decision: null },
      },
      stepClaimToken(context)
    );
    if (!claim) {
      await createAutopilotLogger(ctx, proposal.kind).skip(ALREADY_TAKEN);
      return halt(ALREADY_TAKEN);
    }
    return next<IdeaState>({ claim });
  },
};

export const draftBlocks = [
  defineWorkflowBlock<typeof proposalConfigSchema, PostState>({
    type: "autopilot.write-post",
    kind: "ai",
    title: "Write the post",
    logo: "github",
    configSchema: proposalConfigSchema,
    steps: [
      claimTopicStep,
      {
        id: "credits",
        title: "Hold credits",
        run: async (context) => {
          const { claim } = requireStepState(context.state, "claim");
          const held = await holdAutopilotCredits({
            ctx: await loadAutopilotContext(context),
            claim,
            whenUnavailable: "suggest",
          });
          return "reservation" in held
            ? next({ reservation: held.reservation })
            : halt(held.reason, {
                findingId: claim.finding.id,
                acted: held.acted,
              });
        },
      },
      {
        id: "rules",
        title: "Check the team's rules",
        run: async (context) => {
          const { claim } = requireStepState(context.state, "claim");
          const ctx = await loadAutopilotContext(context);
          const allowed = await draftFollowsRules({
            ctx,
            log: createAutopilotLogger(ctx, claim.finding.kind),
            claim,
            brief: context.config.brief,
            decisionMemory: await loadDecisionMemory(ctx.organizationId),
          });
          return allowed
            ? next()
            : halt("The team's rules rule this post out", {
                findingId: claim.finding.id,
                acted: actedOn(claim, "ready"),
              });
        },
      },
      {
        id: "slot",
        title: "Reserve a draft slot",
        run: async (context) => {
          const { claim } = requireStepState(context.state, "claim");
          const ctx = await loadAutopilotContext(context);
          const slot = await reserveDraftSlot(
            claim,
            context.config.confidence === null ? null : ctx.maxOpenPullRequests
          );
          if (slot === "reserved") {
            return next();
          }
          if (slot === "lost") {
            return halt("Another run took this topic", {
              findingId: claim.finding.id,
            });
          }
          const reason =
            "The workspace's draft pull request limit is already in use";
          await markFindingSuggested(claim);
          await createAutopilotLogger(ctx, claim.finding.kind).skip(reason);
          return halt(reason, {
            findingId: claim.finding.id,
            acted: actedOn(claim, "ready"),
          });
        },
      },
      {
        id: "write",
        title: "Write the post",
        sideEffect: true,
        run: async (context) => {
          const { claim } = requireStepState(context.state, "claim");
          const ctx = await loadAutopilotContext(context);
          const usage = createGitHubMentionUsageCollector();
          const decisionMemory = await loadDecisionMemory(ctx.organizationId);
          const draft = await withAutopilotFindingLease(claim, () =>
            writeBlogDraft({
              ctx,
              claim,
              brief: context.config.brief,
              decisionMemory,
              log: createAutopilotLogger(ctx, claim.finding.kind),
              onUsage: (used) => usage.add(used),
            })
          );
          return next({ draft, usage: [usage.get()] });
        },
      },
      {
        id: "image",
        title: "Render the hero image",
        optional: true,
        run: async (context) => {
          const { claim, draft } = requireStepState(
            context.state,
            "claim",
            "draft"
          );
          const ctx = await loadAutopilotContext(context);
          const usage = createGitHubMentionUsageCollector();
          const hero = await renderBlogDraftHeroImage({
            ctx,
            log: createAutopilotLogger(ctx, claim.finding.kind),
            draft,
            onUsage: (used) => usage.add(used),
          });
          return next({
            hero,
            usage: [...(context.state.usage ?? []), usage.get()],
          });
        },
      },
      {
        id: "pull-request",
        title: "Open the pull request",
        sideEffect: true,
        run: async (context) => {
          const { claim, draft } = requireStepState(
            context.state,
            "claim",
            "draft"
          );
          const ctx = await loadAutopilotContext(context);
          const pullRequest = await openBlogDraftPullRequest({
            ctx,
            claim,
            draft,
            hero: context.state.hero ?? null,
            log: createAutopilotLogger(ctx, claim.finding.kind),
          });
          return succeed(
            pullRequest
              ? {
                  findingId: claim.finding.id,
                  opened: true,
                  url: pullRequest.url,
                  acted: actedOn(claim, "in_progress", pullRequest.url),
                }
              : { findingId: claim.finding.id, opened: false }
          );
        },
      },
    ],
    finally: settleClaimedDraft,
  }),
  defineWorkflowBlock<typeof proposalConfigSchema, IdeaState>({
    type: "autopilot.save-idea",
    kind: "task",
    title: "Save as an idea",
    configSchema: proposalConfigSchema,
    steps: [
      claimTopicStep,
      {
        id: "save",
        title: "Save the idea",
        run: async (context) => {
          const { claim } = requireStepState(context.state, "claim");
          const { brief, confidence } = context.config;
          await markFindingSuggested(claim);
          await createAutopilotLogger(
            autopilotLogScope(context),
            claim.finding.kind
          ).decision(
            `Saved "${brief.topic}" as an idea instead of a pull request`,
            {
              confidence,
              next: "Waits for a reply on GitHub or a click on the dashboard",
            }
          );
          return succeed({
            findingId: claim.finding.id,
            acted: actedOn(claim, "ready"),
          });
        },
      },
    ],
  }),
];
