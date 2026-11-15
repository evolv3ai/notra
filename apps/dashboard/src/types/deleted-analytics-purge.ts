import type { deletedAnalyticsPurgeSchema } from "@notra/schemas/dashboard/workflows/deleted-analytics-purge";
import type * as z from "zod";

export type DeletedAnalyticsPurgeInput = z.infer<
  typeof deletedAnalyticsPurgeSchema
>;
