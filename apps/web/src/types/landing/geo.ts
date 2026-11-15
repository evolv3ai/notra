import type { ComponentType, SVGProps } from "react";

export type EngineId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "grok"
  | "kimi";

export type LandingEngineId = EngineId | "claude-code" | "glm";

export type LandingEngineIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface LandingEngineIconProps {
  engine: LandingEngineId;
  className?: string;
}

export interface EngineRateRow {
  id: EngineId;
  mentionRate: number;
  mentions: number;
  checks: number;
  avgPosition: number;
  lastChecked: string;
}

export interface ShareRowLogo {
  src: string;
  darkSrc?: string;
  invertOnDark?: boolean;
  tileOnDark?: boolean;
}

export interface ShareRow {
  id: string;
  brand: string;
  logo: ShareRowLogo;
  share: number;
  mentions: number;
  color: string;
  isYou?: boolean;
}

export interface KpiTile {
  id: string;
  label: string;
  value: string;
}

type TrafficPurpose =
  | "training-crawler"
  | "search-index"
  | "assistant-browse"
  | "assistant-referral";

export interface CitationRow {
  id: string;
  agoSeconds: number;
  provider: string;
  engine: LandingEngineId;
  path: string;
  purpose: TrafficPurpose;
  markdown?: boolean;
}

export interface LiveCitationRow extends CitationRow {
  offsetMs: number;
}

export interface LiveTrafficProvider {
  provider: string;
  engine: LandingEngineId;
  purposes: TrafficPurpose[];
}

export interface CitationRowsProps {
  rows: LiveCitationRow[];
  base: number | null;
  animated: boolean;
  enteringId?: string | null;
  onEntered?: (id: string) => void;
  headers: { when: string; provider: string; path: string; purpose: string };
}

export interface TrafficSourceRow {
  id: string;
  source: string;
  engine: LandingEngineId;
  purpose: TrafficPurpose;
  visits: number;
  lastSeen: string;
}

export interface GapRow {
  id: string;
  content: string;
  opportunity: number;
  mentionRate: number;
  missing: EngineId[];
}

export type AnswerSentiment = "positive" | "neutral" | "negative";

export type AnswerPositionTone = "top" | "mid" | "low";

export interface AnswerEngineResult {
  id: EngineId;
  mentioned: boolean;
  position: number | null;
  sentiment: AnswerSentiment;
  excerpt: string;
}
