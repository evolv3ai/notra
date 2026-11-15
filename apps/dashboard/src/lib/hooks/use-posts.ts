"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "../orpc/query";
import { useActiveProject } from "./use-active-project";

export function useDashboardHomeContent(organizationId: string) {
  const tToast = useTranslations("content.toasts");
  const { projectId, isResolved } = useActiveProject();

  return useQuery({
    ...dashboardOrpc.content.home.get.queryOptions({
      input: {
        organizationId,
        projectId: projectId ?? undefined,
      },
    }),
    enabled: !!organizationId && isResolved,
    meta: { errorMessage: tToast("loadDashboardContentFailed") },
  });
}
