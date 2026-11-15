import { SITE_DEPLOYMENT_IN_PROGRESS_STATUSES } from "@notra/sites-core/constants/sites";

import type { PostPreviewState } from "@/types/sites";

export function isPostPreviewBuilding(status: string | undefined): boolean {
  return SITE_DEPLOYMENT_IN_PROGRESS_STATUSES.some((value) => value === status);
}

/** Undefined keeps the stored password when nothing new was typed. */
export function postPreviewPassword(params: {
  enabled: boolean;
  entered: string | null;
  stored: boolean;
}): string | null | undefined {
  if (!params.enabled) {
    return null;
  }
  if (params.entered) {
    return params.entered;
  }
  return params.stored ? undefined : null;
}

export function postPreviewState(params: {
  building: boolean;
  live: boolean;
  status: string | undefined;
}): PostPreviewState {
  if (params.building) {
    return "building";
  }
  if (params.status === "failed") {
    return "failed";
  }
  if (params.live) {
    return "live";
  }
  return params.status === "ready" ? "expired" : "none";
}
