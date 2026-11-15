import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  agentFeedbackActivityInputSchema,
  agentFeedbackItemInputSchema,
  agentFeedbackListInputSchema,
  agentFeedbackOrganizationInputSchema,
  agentFeedbackUpdateStatusInputSchema,
} from "@notra/schemas/dashboard/agent-feedback";
import { Effect } from "effect";

import { getAgentFeedbackActivity } from "@/lib/agent-feedback/activity.server";
import type { AgentFeedbackRouterError } from "@/lib/agent-feedback/errors";
import { readAgentFeedbackOrganization } from "@/lib/agent-feedback/organization";
import {
  deleteAgentFeedback,
  listAgentFeedback,
  updateAgentFeedbackStatus,
} from "@/lib/agent-feedback/programs";
import { buildAgentFeedbackSetup } from "@/lib/agent-feedback/snippet";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { runOrpcEffect } from "@/lib/orpc/effect";
import { toAgentFeedbackOrpcError } from "@/lib/orpc/utils/agent-feedback-errors";

function agentFeedbackHandler<
  TInput,
  TOutput,
  TError extends AgentFeedbackRouterError,
>(run: (input: TInput) => Effect.Effect<TOutput, TError>) {
  return async ({ input }: { input: TInput }): Promise<TOutput> =>
    await runOrpcEffect(run(input), toAgentFeedbackOrpcError);
}

export const agentFeedbackRouter = {
  list: authorizedProcedure
    .input(agentFeedbackListInputSchema)
    .use(withOrganizationAccess)
    .handler(agentFeedbackHandler((input) => listAgentFeedback(input))),
  updateStatus: authorizedProcedure
    .input(agentFeedbackUpdateStatusInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const item = await runOrpcEffect(
        updateAgentFeedbackStatus(input),
        toAgentFeedbackOrpcError
      );

      trackServerEvent({
        event: POSTHOG_EVENTS.AGENT_FEEDBACK_STATUS_CHANGED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          feedback_id: item.id,
          status: item.status,
          kind: item.kind,
          sentiment: item.sentiment,
        },
      });

      return item;
    }),
  delete: authorizedProcedure
    .input(agentFeedbackItemInputSchema)
    .use(withOrganizationAccess)
    .handler(agentFeedbackHandler((input) => deleteAgentFeedback(input))),
  activity: authorizedProcedure
    .input(agentFeedbackActivityInputSchema)
    .use(withOrganizationAccess)
    .handler(({ input }) =>
      getAgentFeedbackActivity(input.organizationId, input)
    ),
  setup: authorizedProcedure
    .input(agentFeedbackOrganizationInputSchema)
    .use(withOrganizationAccess)
    .handler(
      agentFeedbackHandler((input) =>
        Effect.map(
          readAgentFeedbackOrganization(input.organizationId),
          buildAgentFeedbackSetup
        )
      )
    ),
};
