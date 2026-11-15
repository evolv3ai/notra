import {
  AUTOPILOT_EVENT_LEVELS,
  AUTOPILOT_JOB_KINDS,
  AUTOPILOT_RUN_STATUSES,
  AUTOPILOT_RUN_TRIGGERS,
} from "@notra/db/constants/autopilot";
import { z } from "zod";

export const autopilotAdminRunsInputSchema = z.object({
  action: z.literal("runs"),
  organizationId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  before: z.iso.datetime().optional(),
  beforeId: z.string().min(1).optional(),
  status: z.enum(AUTOPILOT_RUN_STATUSES).optional(),
});
export const autopilotAdminTraceInputSchema = z.object({
  action: z.literal("trace"),
  runId: z.string().min(1),
  includeDetail: z.boolean().default(false),
});

export const autopilotAdminRequestSchema = z.discriminatedUnion("action", [
  autopilotAdminRunsInputSchema,
  autopilotAdminTraceInputSchema,
  z.object({
    action: z.literal("findings"),
    organizationId: z.string().min(1),
  }),
]);

export const autopilotAdminRunSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationSlug: z.string(),
  trigger: z.enum(AUTOPILOT_RUN_TRIGGERS),
  status: z.enum(AUTOPILOT_RUN_STATUSES),
  summary: z
    .object({
      findings: z.number(),
      proposed: z.number(),
      failed: z.number(),
      insights: z.array(z.string()).optional(),
    })
    .nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  heartbeatAt: z.iso.datetime(),
});

export const autopilotAdminRunsResponseSchema = z.object({
  runs: z.array(autopilotAdminRunSchema),
});

export const autopilotAdminTraceResponseSchema = z.object({
  run: autopilotAdminRunSchema.extend({
    slackMessageTs: z.string().nullable(),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      job: z.enum(AUTOPILOT_JOB_KINDS).nullable(),
      level: z.enum(AUTOPILOT_EVENT_LEVELS),
      message: z.string(),
      internal: z.boolean(),
      createdAt: z.iso.datetime(),
      data: z.record(z.string(), z.unknown()).nullable(),
      detail: z.record(z.string(), z.unknown()).nullable(),
    })
  ),
  findings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      status: z.string(),
      pullRequestUrl: z.string().nullable(),
      repository: z.string().nullable(),
      errorMessage: z.string().nullable(),
    })
  ),
  detailExpired: z.boolean(),
  truncated: z.boolean(),
});
