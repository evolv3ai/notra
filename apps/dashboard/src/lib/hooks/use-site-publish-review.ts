import { useQuery } from "@tanstack/react-query";

import { useSitePublishMutation } from "@/lib/hooks/use-site-publish-mutation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishDialogProps } from "@/types/components/sites";
import { siteDraftValidationOptions } from "@/utils/site-draft-validation-options";
import { siteDraftVersion } from "@/utils/site-draft-version";
import {
  siteValidationBlocksReview,
  siteValidationReady,
} from "@/utils/site-validation-ready";

export function useSitePublishReview(props: SitePublishDialogProps) {
  const {
    organizationId,
    siteId,
    branch,
    drafts,
    draftCount,
    open,
    unsaved,
    saving,
  } = props;
  const version = siteDraftVersion(drafts);
  const validation = useQuery(
    siteDraftValidationOptions(
      { organizationId, siteId, branch },
      version,
      open && !unsaved && !saving
    )
  );
  const statusOptions = dashboardOrpc.sites.branches.status.queryOptions({
    input: { organizationId, siteId, branch },
    enabled: open,
    staleTime: 0,
  });
  const status = useQuery({
    ...statusOptions,
  });
  const feature = Boolean(
    props.branchControls?.branch &&
    props.branchControls.branch !== props.branchControls.productionBranch
  );
  const direct = !feature && status.data?.canPublishDirect === true;
  const ready =
    !unsaved &&
    !saving &&
    siteValidationReady(validation) &&
    status.isSuccess &&
    !status.isPlaceholderData;
  // The server re-validates before committing, so a running check never
  // blocks the click; only a known failure does.
  const canPublish =
    direct &&
    !unsaved &&
    status.isSuccess &&
    !siteValidationBlocksReview(validation) &&
    (draftCount > 0 || Boolean(saving));
  const publish = useSitePublishMutation(props);
  return {
    validation,
    status,
    feature,
    direct,
    ready,
    canPublish,
    publish,
    target:
      props.branchControls?.productionBranch ??
      status.data?.branch ??
      branch ??
      "",
  };
}
