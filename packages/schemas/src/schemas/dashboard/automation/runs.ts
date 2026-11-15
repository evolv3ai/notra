import "zod/compile";
import { AUTOMATION_RUN_STATUSES } from "@notra/db/constants/automation-runs";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import { AUTOMATION_RUNS_PAGE_SIZE } from "../../../constants/dashboard/automation-runs";

export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export const listAutomationRunsInputSchema = organizationIdInputSchema.extend({
  /** Only runs of this automation; all automations when omitted. */
  automationId: z.string().min(1).optional(),
  status: z.enum(AUTOMATION_RUN_STATUSES).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(AUTOMATION_RUNS_PAGE_SIZE),
});
