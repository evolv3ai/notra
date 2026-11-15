import type { AnySuite, CostSource } from "./eval";

export interface MeasuredModel {
  readonly modelId: string;
  readonly label: string;
  readonly runId: string;
  readonly runAt: string;
  readonly cases: number;
  readonly errors: number;
  readonly errorRate: number;
  readonly score: number;
  readonly scoreSe: number;
  readonly passRate: number;
  readonly p50Ms: number;
  readonly costPerCall?: number;
  readonly costSource: CostSource;
  readonly costKnown: boolean;
}

export interface ModelEvidence extends MeasuredModel {
  readonly frontier: boolean;
  readonly eligible: boolean;
  readonly blocker?: string;
}

export interface Candidate {
  readonly modelId: string;
  readonly label: string;
  readonly estCostPerCall: number;
}

export interface SuitePick {
  readonly suite: AnySuite;
  readonly evidence: readonly ModelEvidence[];
  readonly production?: ModelEvidence;
  readonly recommended?: ModelEvidence;
  readonly bestScore: number;
  readonly candidates: readonly Candidate[];
  readonly volume: number;
  readonly includedIn?: string;
  readonly smallSample: boolean;
  readonly monthlyNow?: number;
  readonly monthlyRecommended?: number;
}

export interface PickerSettings {
  tolerancePts: number;
  volumes: Record<string, number>;
}
