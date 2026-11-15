import type {
  ogTemplateSchema,
  savedOgTemplateSchema,
  ogImageResultSchema,
} from "@notra/ai/schemas/og-image";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import type { OgDesignCallStatus } from "@notra/db/types/og-image";
import type { z } from "zod";

export type OgTemplate = z.infer<typeof ogTemplateSchema>;
export type SavedOgTemplate = z.infer<typeof savedOgTemplateSchema>;
export type OgImageResult = z.infer<typeof ogImageResultSchema>;
export interface OgDesignCall {
  id: string;
  stage: "design" | "review";
  requestedModel: string;
  status: OgDesignCallStatus;
  usage?: AgentTokenUsage;
  error?: string;
}
export type OgDesignParams = Pick<
  GenerateOgImageParams,
  "organizationId" | "onUsage" | "signal"
> & {
  onCall?: (call: OgDesignCall) => Promise<void>;
};
export type OgDesignClaim =
  | { kind: "cached"; document: SavedOgTemplate }
  | { kind: "lease"; runId: string }
  | { kind: "unavailable"; reason: string };
export interface OgRenderBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface OgAssetTarget extends Pick<
  OgRenderBounds,
  "width" | "height"
> {
  decorative?: boolean;
  fit?: "contain" | "cover" | "fill";
}
export interface OgBrandContext {
  id: string;
  name: string;
  websiteUrl: string | null;
  guideline: unknown;
  assets: { id: string; url: string; label: string }[];
}
export interface GenerateOgImageParams {
  organizationId: string;
  brandIdentityId?: string;
  title: string;
  onUsage?: (usage: AgentTokenUsage) => void;
  signal?: AbortSignal;
}
export interface OgImageToolConfig {
  organizationId: string;
  brandIdentityId?: string;
  useMarkup?: boolean;
  chargeAiCredits?: boolean;
  onUsage?: (usage: AgentTokenUsage) => void;
}
export interface OgResearch {
  styleguide: unknown;
  screenshot: string | null;
  ogImage: string | null;
  assets: OgBrandContext["assets"];
  evidence: string;
  warnings: string[];
}
export interface OgAssetCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface OgFetchResult {
  bytes: Buffer;
  contentType: string;
  url: string;
}
export interface OgVariableFont {
  variation?: {
    getTransform: (
      glyph: import("opentype.js").Glyph,
      coordinates: Record<string, number>
    ) => import("opentype.js").Glyph;
  };
}
