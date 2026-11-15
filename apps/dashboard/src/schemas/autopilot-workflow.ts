import * as z from "zod";

import { AUTOPILOT_OBSERVATION_STEPS } from "@/constants/autopilot-workflow";
import type {
  AutopilotProposal,
  AutopilotRunObservation,
} from "@/types/autopilot";
import type {
  AutopilotPlanActed,
  AutopilotPlanDecision,
  AutopilotPostBrief,
} from "@/types/autopilot-runtime";

export const autopilotRunConfigSchema = z.object({
  autopilotRunId: z.string().min(1),
});

const optionalListSchema = z
  .array(z.unknown())
  .default([])
  .transform((values) =>
    values.flatMap((value) => {
      if (value === undefined || value === null) {
        return [];
      }
      return Array.isArray(value) ? value : [value];
    })
  );

const proposalSchema = z.custom<AutopilotProposal>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as AutopilotProposal).fingerprint === "string",
  "Expected a proposal"
);

const briefSchema = z.object({
  topic: z.string(),
  angle: z.string(),
  evidence: z.string(),
}) satisfies z.ZodType<AutopilotPostBrief>;

export const proposalConfigSchema = autopilotRunConfigSchema.extend({
  proposal: proposalSchema,
  brief: briefSchema,
  confidence: z.number().nullable().default(null),
});

export const gatherConfigSchema = autopilotRunConfigSchema.extend({
  jobs: z
    .array(z.enum(AUTOPILOT_OBSERVATION_STEPS.map(({ job }) => job)))
    .optional(),
});

const decisionSchema = z.custom<AutopilotPlanDecision>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as AutopilotPlanDecision).outcome === "string",
  "Expected a plan"
);

const actedSchema = z.custom<AutopilotPlanActed>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as AutopilotPlanActed).findingId === "string",
  "Expected what the draft became"
);

export const finishConfigSchema = autopilotRunConfigSchema.extend({
  decision: decisionSchema.optional(),
  acted: optionalListSchema.transform((values) =>
    values.flatMap((value) => {
      const parsed = actedSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    })
  ),
  insights: optionalListSchema.transform((values) => values.map(String)),
});

export const briefConfigSchema = finishConfigSchema.extend({
  previousRunAt: z.string().nullable().default(null),
});

export const planConfigSchema = autopilotRunConfigSchema.extend({
  observations: optionalListSchema.transform(
    (values) => values as AutopilotRunObservation[]
  ),
});

export const failRunConfigSchema = autopilotRunConfigSchema.extend({
  slackMessageTs: z.string().nullable().default(null),
  insights: optionalListSchema.transform((values) => values.map(String)),
  scheduled: z.boolean().default(true),
});
