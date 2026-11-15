import * as z from "zod";

import {
  WORKFLOW_ERROR_PORT,
  WORKFLOW_OTHERWISE_PORT,
  WORKFLOW_RULE_OPERATORS,
} from "../constants/graph";
import { workflowIdSchema } from "./graph";

export const workflowRuleSchema = z.object({
  subject: z.unknown(),
  operator: z.enum(WORKFLOW_RULE_OPERATORS),
  value: z.unknown().optional(),
});

export const workflowIfConfigSchema = z.object({ rule: workflowRuleSchema });

export const workflowSwitchConfigSchema = z.object({
  cases: z
    .array(
      z.object({
        id: workflowIdSchema.refine(
          (id) => id !== WORKFLOW_OTHERWISE_PORT && id !== WORKFLOW_ERROR_PORT,
          `"${WORKFLOW_OTHERWISE_PORT}" and "${WORKFLOW_ERROR_PORT}" are taken`
        ),
        label: z.string().max(80).optional(),
        rule: workflowRuleSchema,
      })
    )
    .min(1)
    .max(20)
    .refine(
      (cases) => new Set(cases.map((item) => item.id)).size === cases.length,
      "Two cases share an id"
    ),
});

export const workflowCallConfigSchema = z.object({
  workflow: z.string().min(1).max(120),
  input: z.record(z.string(), z.unknown()).optional(),
});
