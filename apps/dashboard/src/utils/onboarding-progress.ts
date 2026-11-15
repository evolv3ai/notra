import type { GeoOnboardingStage } from "@notra/geo-core/types/geo";

import type {
  OnboardingProgressHrefInput,
  OnboardingProgressHrefs,
} from "@/types/onboarding";
import {
  geoOnboardingCompetitorsPath,
  geoOnboardingPath,
  geoOnboardingWorkspacePath,
} from "@/utils/geo-paths";

function isStepReachable(
  step: number,
  hasOrganization: boolean,
  hasBrand: boolean,
  stage: GeoOnboardingStage | null
): boolean {
  if (step === 1) {
    return hasOrganization;
  }
  if (step === 2) {
    return hasBrand;
  }
  return stage === "competitors" || stage === "complete";
}

export function onboardingProgressHrefs({
  current,
  hasOrganization,
  hasBrand,
  stage,
  projectId,
  replay = false,
}: OnboardingProgressHrefInput): OnboardingProgressHrefs {
  const paths = [
    geoOnboardingWorkspacePath(projectId, replay),
    geoOnboardingPath(projectId, replay),
    geoOnboardingCompetitorsPath(projectId, replay),
  ];

  return paths.map((path, index) => {
    const step = index + 1;
    if (step === current) {
      return null;
    }
    return isStepReachable(step, hasOrganization, hasBrand, stage)
      ? path
      : null;
  });
}
