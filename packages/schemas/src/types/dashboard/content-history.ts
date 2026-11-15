import type { z } from "zod";

import type { CONTENT_HISTORY_CHANGES } from "../../constants/dashboard/content-history";
import type {
  contentHistoryEntrySchema,
  contentHistoryVersionSchema,
} from "../../schemas/dashboard/content-history";

export type ContentHistoryEntry = z.infer<typeof contentHistoryEntrySchema>;
export type ContentHistoryVersion = z.infer<typeof contentHistoryVersionSchema>;
export type ContentHistoryChange = (typeof CONTENT_HISTORY_CHANGES)[number];
