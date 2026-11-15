"use client";

import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SiteSuspensionCategory } from "@notra/sites-core/types/sites";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@notra/ui/components/ui/alert-dialog";
import { Button } from "@notra/ui/components/ui/button";
import { useState } from "react";

import { SuspensionFields } from "@/components/moderation/suspension-fields";
import { REASON_PLACEHOLDERS } from "@/constants/moderation";
import { useSiteActions } from "@/hooks/use-site-actions";
import type { SiteSuspendDialogProps } from "@/types/sites";

export function SiteSuspendDialog({
  siteId,
  siteName,
  reactivates,
  disabledReason,
  defaultOpen = false,
}: SiteSuspendDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<SiteSuspensionCategory | null>(null);
  // Fixed when the dialog opens, so the refetch after the mutation can't swap
  // its copy while it closes.
  const [reactivating, setReactivating] = useState(reactivates);
  const { setSuspended } = useSiteActions();
  const ready = reason.trim().length > 0 && (reactivating || category !== null);

  function onOpenChange(next: boolean) {
    if (next) {
      setReactivating(reactivates);
      setReason("");
      setCategory(null);
    }
    setOpen(next);
  }

  function confirm() {
    setSuspended.mutate(
      {
        siteId,
        suspended: !reactivating,
        reason: reason.trim(),
        category: reactivating ? undefined : (category ?? undefined),
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger
        disabled={disabledReason !== undefined}
        render={
          <Button
            size="sm"
            title={disabledReason}
            variant={reactivates ? "outline" : "ghost"}
          />
        }
      >
        <HugeiconsIcon icon={reactivates ? PlayIcon : PauseIcon} />
        {reactivates ? "Reactivate site" : "Suspend site"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {reactivating ? `Reactivate ${siteName}?` : `Suspend ${siteName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reactivating
              ? "The site is served again right away, from its current production deployment."
              : "Every domain of this site stops serving right away and its builds stop. Visitors see an offline page with the category and a report link, and the workspace owners get an email with the reason and how to appeal."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <SuspensionFields
          category={category}
          categoryHint="Shown to visitors on the offline page."
          id="site-suspend"
          onCategoryChange={reactivating ? undefined : setCategory}
          onReasonChange={setReason}
          reason={reason}
          reasonPlaceholder={
            reactivating
              ? REASON_PLACEHOLDERS.lift
              : REASON_PLACEHOLDERS.suspend
          }
          reasonHint={
            reactivating
              ? "Recorded in the audit log, e.g. the appeal you accepted."
              : "Recorded in the audit log and emailed to the owners. Not shown to visitors."
          }
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={setSuspended.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || setSuspended.isPending}
            onClick={confirm}
            variant={reactivating ? "default" : "destructive"}
          >
            {reactivating ? "Reactivate" : "Suspend site"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
