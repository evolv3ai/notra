"use client";

import { SiteBranchDialog } from "@/components/sites/branches/site-branch-dialog";
import { SiteBranchMenu } from "@/components/sites/branches/site-branch-menu";
import type {
  SiteBranchControllerProps,
  SiteBranchSwitcherProps,
} from "@/types/site-branches";

/** One version menu holds both the branch selection and its options. */
export function SiteBranchSwitcher({
  controller,
  menuActive,
}: SiteBranchSwitcherProps) {
  const { props, queries, busy, switchTo, setAction } = controller;
  const { productionBranch } = props;
  const { status, current } = queries;
  return (
    <div className="max-w-72 min-w-0" data-site-branch-box="">
      <SiteBranchMenu
        open={menuActive && queries.menuOpen}
        onOpenChange={queries.setMenuOpen}
        current={current}
        productionBranch={productionBranch}
        pullRequest={status.data?.pullRequest}
        entries={queries.branches.data ?? []}
        loading={queries.branches.isPending}
        disabled={busy}
        search={queries.search}
        onSearch={queries.setSearch}
        onSelect={switchTo}
        onAction={setAction}
        creating={controller.creating}
        onStartCreate={controller.startCreate}
        error={queries.branches.isError}
        onRetry={() => {
          void queries.branches.refetch();
        }}
      />
    </div>
  );
}

/** Truthful save and commit state for the editor toolbar. */
/** Rename, delete and discard confirmations started from the branch controls. */
export function SiteBranchActionDialog({
  controller,
}: SiteBranchControllerProps) {
  const { action, setAction, mutations, props } = controller;
  return (
    <SiteBranchDialog
      key={action ? `${action.kind}:${action.branch}` : "closed"}
      action={action}
      draftCount={props.draftCount}
      loading={mutations.edit.isPending}
      onClose={() => setAction(null)}
      onConfirm={(title, bringChanges) =>
        mutations.edit.mutate({ title, bringChanges })
      }
    />
  );
}
