import { freeScanAdminRunInputSchema } from "@notra/schemas/api/free-scan-admin";
import { z } from "zod";

import { FREE_SCAN_MAX_PROMPT_LIMIT } from "@/constants/free-scans";

export const saveFreeScanClaimInputSchema = freeScanAdminRunInputSchema.extend({
  promptLimit: z.number().int().min(1).max(FREE_SCAN_MAX_PROMPT_LIMIT),
  organizationSlug: z.string().trim().min(1).optional(),
});
