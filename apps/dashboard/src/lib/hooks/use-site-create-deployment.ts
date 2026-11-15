import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SITE_CREATE_DEPLOY_POLL_MS } from "@/constants/site-create";
import {
  useDeployLatest,
  useSiteDeployment,
} from "@/lib/hooks/use-site-deployments";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteCreateDeploymentInput } from "@/types/site-create-deploy";

export function useSiteCreateDeployment({
  organizationId,
  siteId,
  deploymentQueued,
}: SiteCreateDeploymentInput) {
  const [retryFromDeploymentId, setRetryFromDeploymentId] = useState<
    string | null
  >(null);
  const queued = deploymentQueued || retryFromDeploymentId !== null;
  const retry = useDeployLatest({ organizationId, siteId });
  const detail = useQuery(
    dashboardOrpc.sites.get.queryOptions({
      input: { organizationId, siteId },
      refetchInterval: (query) => {
        const latest = query.state.data?.deployments[0];
        const settled =
          !queued || (latest && latest.id !== retryFromDeploymentId);
        return settled ? false : SITE_CREATE_DEPLOY_POLL_MS;
      },
    })
  );
  const latestId = detail.data?.deployments[0]?.id ?? "";
  const deploymentId = latestId === retryFromDeploymentId ? "" : latestId;
  const deployment = useSiteDeployment({
    organizationId: deploymentId ? organizationId : "",
    siteId,
    deploymentId,
  });
  const hasDeployment = deploymentId.length > 0;
  const record = hasDeployment ? (deployment.data?.deployment ?? null) : null;

  return {
    queued,
    record,
    log: record ? (deployment.data?.log ?? "") : "",
    lookupFailed: detail.isError || (hasDeployment && deployment.isError),
    isReloadingStatus: detail.isFetching || deployment.isFetching,
    reloadStatus: () => {
      void detail.refetch();
      if (hasDeployment) {
        void deployment.refetch();
      }
    },
    retry,
    retryDeployment: () => {
      if (!retry.isPending) {
        retry.mutate(undefined, {
          onSuccess: () => setRetryFromDeploymentId(deploymentId),
        });
      }
    },
  };
}
