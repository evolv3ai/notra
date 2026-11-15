"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/button";
import { OrganizationSuspendActions } from "@/components/moderation/organization-suspend-dialog";
import { UserBanDialog } from "@/components/moderation/user-ban-dialog";
import { SiteSuspendDialog } from "@/components/sites/site-suspend-dialog";
import { useSiteActions } from "@/hooks/use-site-actions";
import type { SiteModerationActionsProps } from "@/types/sites";
import { isWorkspaceActionUnfinished } from "@/utils/moderation-outcome";

/**
 * The site page's header actions. `action` opens one dialog on load, but only
 * while that action still applies: a repeated or stale Slack link must never
 * open the reverse action, such as a lift instead of a takedown.
 */
export function SiteModerationActions({
  site,
  action,
  canDeploy,
}: SiteModerationActionsProps) {
  const { deployLatest } = useSiteActions();
  const { owner, organization } = site;
  const workspaceSuspended = organization.suspendedAt !== null;
  const workspaceUnfinished = isWorkspaceActionUnfinished(
    workspaceSuspended,
    organization
  );
  // Notra reactivates only its own takedown. An owner pause, or a site down
  // with a suspended workspace, is offered a Notra suspension instead, and a
  // takedown of its own waits until the workspace is lifted.
  const reactivates =
    site.status === "suspended" &&
    site.suspendedBy === "notra" &&
    !(workspaceSuspended && site.suspendedWithOrganization);
  const reactivateBlocked = reactivates && workspaceSuspended;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {owner ? (
        <UserBanDialog
          defaultOpen={action === "ban-owner" && !owner.banned}
          label={owner.banned ? "Unban owner" : "Ban owner"}
          user={owner}
        />
      ) : null}
      <OrganizationSuspendActions
        openOnLoad={action === "suspend-workspace"}
        organizationId={organization.id}
        organizationName={organization.name}
        suspended={workspaceSuspended}
        unfinished={workspaceUnfinished}
      />
      <SiteSuspendDialog
        defaultOpen={action === "suspend-site" && !reactivates}
        disabledReason={
          reactivateBlocked ? "Lift the workspace suspension first" : undefined
        }
        reactivates={reactivates}
        siteId={site.id}
        siteName={site.name}
      />
      <Button
        disabled={!canDeploy || deployLatest.isPending}
        onClick={() => deployLatest.mutate({ siteId: site.id })}
        size="sm"
      >
        <HugeiconsIcon icon={Rocket01Icon} />
        Deploy latest
      </Button>
    </div>
  );
}
