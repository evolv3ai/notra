import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentDeleteDialogProps } from "@/types/content/git-publishing";

export function ContentDeleteDialog({
  contentId,
  organizationId,
  title,
  open,
  onOpenChange,
  pending,
  onConfirm,
}: ContentDeleteDialogProps) {
  const t = useTranslations("content.gitPublishing");
  const common = useTranslations("common");
  const id = useId();
  const [remove, setRemove] = useState(false);
  const { data, isLoading } = useQuery(
    dashboardOrpc.content.get.queryOptions({
      input: { organizationId, contentId },
      enabled: open,
    })
  );
  const published = data?.content.githubPublish;
  return (
    <ConfirmDialog
      title={common("labels.deletePost")}
      description={common("messages.thisWillPermanentlyDeleteTitle", { title })}
      confirmLabel={common("actions.delete")}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRemove(false);
        }
        onOpenChange(next);
      }}
      pending={pending || isLoading}
      onConfirm={() => {
        onConfirm(remove);
        setRemove(false);
      }}
      variant="destructive"
    >
      {published ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Switch id={id} checked={remove} onCheckedChange={setRemove} />
            <Label htmlFor={id}>
              {t("removeTitle", {
                target: `${published.owner}/${published.repo}`,
              })}
            </Label>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("removeDescription")}
          </p>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
