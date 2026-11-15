"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteBranchPrimaryAction } from "@/components/sites/branches/site-branch-primary-action";
import { useSiteBranchActions } from "@/lib/hooks/use-site-branch-actions";
import type { SiteBranchPublishActionsProps } from "@/types/site-branches";

export function SiteBranchPublishActions({
  controls,
  status,
  invalid,
  describedBy,
}: SiteBranchPublishActionsProps) {
  const writing = useTranslations("sites.writing");
  const mutations = useSiteBranchActions(controls, null, () => {});
  const feature = Boolean(
    controls.branch && controls.branch !== controls.productionBranch
  );
  const busy = mutations.create.isPending || mutations.review.isPending;
  const flush = () => {
    void controls.onFlush().catch(() => toast.error(writing("saveFirst")));
  };
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {controls.unsaved ? (
        <Button disabled={busy} onClick={flush} variant="outline">
          {writing("retrySave")}
        </Button>
      ) : null}
      <SiteBranchPrimaryAction
        describedBy={describedBy}
        feature={feature}
        status={status}
        busy={busy}
        invalid={invalid}
        unsaved={controls.unsaved}
        draftCount={controls.draftCount}
        onCreate={() => mutations.create.mutate("")}
        onPublish={controls.onPublish}
        onReview={(merge) => mutations.review.mutate(merge)}
        onFlush={flush}
      />
    </div>
  );
}
