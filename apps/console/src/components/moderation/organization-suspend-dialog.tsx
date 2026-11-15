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
import { ORGANIZATION_SUSPENSION_COPY } from "@/constants/moderation";
import { useModerationActions } from "@/hooks/use-moderation-actions";
import type {
  OrganizationSuspendActionsProps,
  OrganizationSuspendDialogProps,
} from "@/types/moderation";
import { organizationSuspensionModes } from "@/utils/moderation-outcome";

/** One workspace action; its copy is fixed by `mode`. */
function OrganizationSuspendDialog({
  organizationId,
  organizationName,
  mode,
  defaultOpen,
}: OrganizationSuspendDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<SiteSuspensionCategory | null>(null);
  const { setOrganizationSuspended } = useModerationActions();
  const copy = ORGANIZATION_SUSPENSION_COPY[mode];
  const ready =
    reason.trim().length > 0 && (!copy.needsCategory || category !== null);

  function onOpenChange(next: boolean) {
    if (next) {
      setReason("");
      setCategory(null);
    }
    setOpen(next);
  }

  function confirm() {
    setOrganizationSuspended.mutate(
      {
        organizationId,
        suspended: !copy.lifts,
        reason: reason.trim(),
        category: copy.needsCategory ? (category ?? undefined) : undefined,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger
        render={<Button size="sm" variant={copy.lifts ? "outline" : "ghost"} />}
      >
        <HugeiconsIcon icon={copy.lifts ? PlayIcon : PauseIcon} />
        {copy.trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${copy.title} ${organizationName}?`}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <SuspensionFields
          category={category}
          categoryHint="Shown to visitors on the offline page of every site."
          id={`organization-${mode}`}
          onCategoryChange={copy.needsCategory ? setCategory : undefined}
          onReasonChange={setReason}
          reason={reason}
          reasonHint={copy.reasonHint}
          reasonPlaceholder={copy.reasonPlaceholder}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={setOrganizationSuspended.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || setOrganizationSuspended.isPending}
            onClick={confirm}
            variant={copy.lifts ? "default" : "destructive"}
          >
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Every workspace action that applies now. An unfinished suspend or lift
 * offers to finish it and also the reverse, so a site that keeps failing
 * can't leave the workspace stuck. `openOnLoad` opens the first suspending
 * action only, never a lift.
 */
export function OrganizationSuspendActions({
  organizationId,
  organizationName,
  suspended,
  unfinished,
  openOnLoad = false,
}: OrganizationSuspendActionsProps) {
  const modes = organizationSuspensionModes(suspended, unfinished);
  const openMode = openOnLoad
    ? modes.find((mode) => !ORGANIZATION_SUSPENSION_COPY[mode].lifts)
    : undefined;
  return (
    <>
      {modes.map((mode) => (
        <OrganizationSuspendDialog
          defaultOpen={mode === openMode}
          key={mode}
          mode={mode}
          organizationId={organizationId}
          organizationName={organizationName}
        />
      ))}
    </>
  );
}
