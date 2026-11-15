import type { ActiveProjectState } from "@/types/hooks/projects";

export function resolvedSiteProjectId(
  project: ActiveProjectState
): string | null {
  if (!project.isResolved || project.isError) {
    return null;
  }
  return project.projectId;
}
