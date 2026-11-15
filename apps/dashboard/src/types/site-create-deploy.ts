import type { SiteCreateDeployPhase } from "@/types/components/sites";
import type { SiteDeploymentRecord } from "@/types/sites";

export interface SiteCreateDeployStateInput {
  queued: boolean;
  lookupFailed: boolean;
  record: SiteDeploymentRecord | null;
}

export interface SiteCreateDeployState {
  phase: SiteCreateDeployPhase;
  status: SiteDeploymentRecord["status"];
  inProgress: boolean;
  failed: boolean;
  ready: boolean;
}

export type SiteCreateDeployHeadlineKey =
  | "statusLoadFailed"
  | "notStarted"
  | "started"
  | "ready"
  | "failed"
  | "waiting";

export interface SiteCreateDeploymentInput {
  organizationId: string;
  siteId: string;
  deploymentQueued: boolean;
}

export interface SiteCreateDeployTiming {
  elapsed: string | null;
  startedSeconds: number;
}
