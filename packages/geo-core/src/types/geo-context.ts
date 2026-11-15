import type { GeoCheckSourceItem } from "@notra/db/types/geo-checks";
import type { DomUtils, parseDocument } from "htmlparser2";
import type { z } from "zod";

import type { GEO_CONTEXT_ENGINES } from "../constants/geo-context";
import type { geoContextResponseSchema } from "../schemas/geo-context";

export type GeoContextEngine = (typeof GEO_CONTEXT_ENGINES)[number];
export type GeoContextResponse = z.infer<typeof geoContextResponseSchema>;
export type GeoContextNode = ReturnType<
  typeof parseDocument
>["children"][number];
export type GeoContextElement = ReturnType<typeof DomUtils.findAll>[number];

export interface GeoContextCapture {
  text: string;
  sources: GeoCheckSourceItem[];
  absent: boolean;
}

export interface GeoContextConversationEngine {
  key: string;
  context: true;
}

export interface GeoContextAction {
  type: "perform" | "wait";
  action?: string;
  milliseconds?: number;
}
