import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";

function useInthConsentStatus(scope: SiteScope) {
  return useQuery(
    dashboardOrpc.sites.integrations.inth.status.queryOptions({
      input: scope,
      enabled: scope.organizationId.length > 0,
    })
  );
}

function useInthProjects(scope: SiteScope, enabled: boolean) {
  return useQuery(
    dashboardOrpc.sites.integrations.inth.projects.queryOptions({
      input: { organizationId: scope.organizationId, siteId: scope.siteId },
      enabled,
    })
  );
}

function useConnectInthProject(scope: SiteScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      dashboardOrpc.sites.integrations.inth.connect.call({
        ...scope,
        projectId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.sites.key(),
      });
    },
  });
}

function useDisconnectInth(scope: SiteScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      dashboardOrpc.sites.integrations.inth.disconnect.call({
        organizationId: scope.organizationId,
        siteId: scope.siteId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.sites.key(),
      });
    },
  });
}

export function useInthConsent(scope: SiteScope) {
  const t = useTranslations("sites.integrationsPage.consent");
  const status = useInthConsentStatus(scope);
  const connected = Boolean(
    status.data?.connected && !status.data.reauthRequired
  );
  const projects = useInthProjects(scope, connected);
  const connect = useConnectInthProject(scope);
  const disconnect = useDisconnectInth(scope);
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId =
    picked ?? status.data?.project?.id ?? projects.data?.[0]?.id ?? null;
  const selected = projects.data?.find((project) => project.id === selectedId);
  const applyProject = (projectId: string) =>
    connect.mutate(projectId, {
      onSuccess: () =>
        toast.success(t("connected"), {
          description: t("connectedDescription"),
        }),
      onError: (error) =>
        toast.error(toErrorMessage(error, t("connectFailed"))),
    });
  return {
    status,
    connected,
    projects,
    connect,
    disconnect,
    selectedId,
    selected,
    setPicked,
    applyProject,
  };
}
