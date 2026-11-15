import {
  defineWorkflowBlock,
  halt,
  next,
  requireStepState,
  succeed,
} from "@notra/workflows/runtime/registry";

import {
  checkReadiness,
  claimReadinessFix,
  openReadinessPullRequest,
  writeReadinessFix,
} from "@/lib/autopilot/readiness";
import { autopilotRunConfigSchema } from "@/schemas/autopilot-workflow";
import type { ReadinessState } from "@/types/autopilot-workflow";

import {
  holdAutopilotCredits,
  loadAutopilotContext,
  settleClaimedDraft,
  stepClaimToken,
  withRunLease,
} from "./shared";

export const readinessBlocks = [
  defineWorkflowBlock<typeof autopilotRunConfigSchema, ReadinessState>({
    type: "autopilot.readiness",
    kind: "integration",
    title: "Fix agent readiness",
    logo: "github",
    configSchema: autopilotRunConfigSchema,
    steps: [
      {
        id: "check",
        title: "Check agent readiness",
        run: async (context) => {
          const ctx = await loadAutopilotContext(context);
          const check = await withRunLease(ctx, () => checkReadiness(ctx));
          if (!check) {
            return halt("This run no longer owns its lease");
          }
          return check.ready ? next({ check }) : halt(check.reason);
        },
      },
      {
        id: "claim",
        title: "Claim the fix",
        run: async (context) => {
          const { check } = requireStepState(context.state, "check");
          const claimed = await claimReadinessFix({
            ctx: await loadAutopilotContext(context),
            check,
            claimToken: stepClaimToken(context),
          });
          return "claim" in claimed
            ? next({ claim: claimed.claim })
            : halt(claimed.reason);
        },
      },
      {
        id: "credits",
        title: "Hold credits",
        run: async (context) => {
          const { claim } = requireStepState(context.state, "claim");
          const held = await holdAutopilotCredits({
            ctx: await loadAutopilotContext(context),
            claim,
            whenUnavailable: "fail",
          });
          return "reservation" in held
            ? next({ reservation: held.reservation })
            : halt(held.reason, { findingId: claim.finding.id });
        },
      },
      {
        id: "write",
        title: "Write the fix",
        sideEffect: true,
        run: async (context) => {
          const { claim, check } = requireStepState(
            context.state,
            "claim",
            "check"
          );
          const fix = await writeReadinessFix({
            ctx: await loadAutopilotContext(context),
            claim,
            check,
          });
          return next({ fix, usage: [fix.usage] });
        },
      },
      {
        id: "pull-request",
        title: "Open the pull request",
        sideEffect: true,
        run: async (context) => {
          const { claim, check, fix } = requireStepState(
            context.state,
            "claim",
            "check",
            "fix"
          );
          if (fix.files.length === 0) {
            return halt("The repository already has what the checks ask for", {
              findingId: claim.finding.id,
            });
          }
          const pullRequest = await openReadinessPullRequest({
            ctx: await loadAutopilotContext(context),
            claim,
            check,
            fix,
          });
          return succeed({ findingId: claim.finding.id, ...pullRequest });
        },
      },
    ],
    finally: settleClaimedDraft,
  }),
];
