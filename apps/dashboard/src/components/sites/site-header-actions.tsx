"use client";

import { useTranslations } from "use-intl";

import { SiteBranchSwitcher } from "@/components/sites/branches/site-branch-controls";
import { SiteBranchPrimaryAction } from "@/components/sites/branches/site-branch-primary-action";
import { SiteHeaderMenu } from "@/components/sites/site-header-menu";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { useSiteBranchVisibility } from "@/lib/hooks/use-site-branch-visibility";

export function SiteHeaderActions() {
  const state = useSiteWorkspace();
  const t = useTranslations("sites.design.workspace");
  const visibility = useSiteBranchVisibility();
  if (!state) {
    return null;
  }
  const { controller, setPublishOpen, invalid, brokenSource, unsaved, saving } =
    state;
  const { queries } = controller;
  const error =
    controller.props.commitStatus === "error" ||
    queries.status.isError ||
    queries.validation.isError ||
    queries.validation.data?.ok === false;
  // Like Mintlify: the selector only hides on an unprotected deployment
  // branch, where the user can opt back in.
  const required =
    queries.feature || queries.status.data?.canPublishDirect === false;
  return (
    <div
      className="ms-auto flex items-center gap-2 self-center py-2 max-sm:w-full max-sm:justify-end"
      data-site-actions
    >
      {required || visibility.show ? (
        <SiteBranchSwitcher controller={controller} menuActive />
      ) : null}
      <SiteHeaderMenu branch={queries.current} branchesRequired={required} />
      <div className="shrink-0" title={error ? t("publishError") : undefined}>
        <SiteBranchPrimaryAction
          error={error}
          {...controller.props}
          feature={queries.feature}
          status={queries.status.data}
          busy={controller.busy}
          saving={saving}
          // Production publishing re-validates on the server, so background
          // checks only hold the button on review branches.
          checking={queries.feature && queries.validating}
          invalid={
            invalid || brokenSource || (unsaved && !saving) || queries.invalid
          }
          onCreate={controller.startCreate}
          onPublish={() => setPublishOpen(true)}
          onReview={() => setPublishOpen(true)}
          onFlush={controller.retrySave}
        />
      </div>
    </div>
  );
}
