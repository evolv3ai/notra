"use client";

import { useTranslations } from "use-intl";

import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import type { SiteCreateProjectProps } from "@/types/components/sites";

export function SiteCreateProject({ organizationId }: SiteCreateProjectProps) {
  const t = useTranslations("sites.new");
  const { projectId, isResolved, isError } = useActiveProject();
  const { projects } = useGeoProjectsDb(organizationId);
  const project = projects.find((candidate) => candidate.id === projectId);

  let message = t("projectRequired");
  if (isError) {
    message = t("projectLoadFailed");
  } else if (!isResolved) {
    message = t("projectLoading");
  } else if (project) {
    message = t("project", { name: project.name });
  }

  return (
    <p className="text-muted-foreground text-sm" role="status">
      {message}
    </p>
  );
}
