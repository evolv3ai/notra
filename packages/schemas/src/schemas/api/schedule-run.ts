import { z } from "zod";

export const scheduleRunRequestSchema = z.object({
  organizationId: z.string().min(1),
  scheduleId: z.string().min(1),
  actorId: z.string().min(1),
});

export const scheduleRunResponseSchema = z.object({
  runId: z.string(),
  workflowRunId: z.string(),
});
