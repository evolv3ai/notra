import * as z from "zod";

import { WORKFLOW_ERROR_POLICIES } from "../constants/graph";
import type { WorkflowGraph } from "../types/graph";

export const workflowIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, - and _ only");

const workflowNodeSchema = z.object({
  id: workflowIdSchema,
  type: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  onError: z.enum(WORKFLOW_ERROR_POLICIES).optional(),
});

const workflowEdgeSchema = z.object({
  id: workflowIdSchema,
  source: workflowIdSchema,
  sourcePort: workflowIdSchema.optional(),
  target: workflowIdSchema,
});

export const workflowGraphSchema: z.ZodType<WorkflowGraph> = z.object({
  nodes: z.array(workflowNodeSchema).min(1).max(100),
  edges: z.array(workflowEdgeSchema).max(250),
  output: z.record(z.string(), z.unknown()).optional(),
  onFailure: z
    .object({
      type: z.string().min(1),
      config: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
