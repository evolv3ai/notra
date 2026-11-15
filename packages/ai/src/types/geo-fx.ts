import type { geoFxUsageSchema } from "@notra/ai/schemas/geo-fx";
import type { z } from "zod";

export type GeoFxUsage = z.infer<typeof geoFxUsageSchema>;

export interface GeoFxConversationMessage {
  role: "user" | "assistant";
  content: string;
}
