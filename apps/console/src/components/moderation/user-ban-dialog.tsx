"use client";

import { UserBlock01Icon, UserCheck01Icon } from "@hugeicons/core-free-icons";
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
import { Checkbox } from "@notra/ui/components/ui/checkbox";
import { Label } from "@notra/ui/components/ui/label";
import { useState } from "react";

import { SuspensionFields } from "@/components/moderation/suspension-fields";
import { BAN_COPY, BAN_REASON_HINTS, UNBAN_COPY } from "@/constants/moderation";
import { useModerationActions } from "@/hooks/use-moderation-actions";
import { hasAdminRole } from "@/lib/auth/role";
import type {
  OwnedWorkspacesOptionProps,
  UserBanDialogProps,
} from "@/types/moderation";

function OwnedWorkspacesOption({
  checked,
  count,
  onCheckedChange,
}: OwnedWorkspacesOptionProps) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        checked={checked}
        id="user-ban-suspend-organizations"
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label
        className="leading-snug font-normal"
        htmlFor="user-ban-suspend-organizations"
      >
        Also suspend the {count} {count === 1 ? "workspace" : "workspaces"} they
        own, with their sites and API keys
      </Label>
    </div>
  );
}

function UserBanTrigger({
  banned,
  label,
}: Pick<UserBanDialogProps, "label"> & { banned: boolean }) {
  return (
    <AlertDialogTrigger
      render={<Button size="sm" variant={banned ? "outline" : "ghost"} />}
    >
      <HugeiconsIcon icon={banned ? UserCheck01Icon : UserBlock01Icon} />
      {label ?? (banned ? "Unban" : "Ban")}
    </AlertDialogTrigger>
  );
}

function UserBanDialogInner({
  user,
  label,
  defaultOpen = false,
}: UserBanDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<SiteSuspensionCategory | null>(null);
  const [suspendOrganizations, setSuspendOrganizations] = useState(false);
  // Fixed when the dialog opens, so the refetch after the mutation can't swap
  // its copy while it closes.
  const [unbanning, setUnbanning] = useState(user.banned);
  const { setUserBanned } = useModerationActions();
  const copy = unbanning ? UNBAN_COPY : BAN_COPY;
  const canSuspend = !unbanning && user.ownedOrganizations > 0;
  const suspending = canSuspend && suspendOrganizations;
  const ready = reason.trim().length > 0 && !(suspending && category === null);

  function onOpenChange(next: boolean) {
    if (next) {
      setUnbanning(user.banned);
      setReason("");
      setCategory(null);
      setSuspendOrganizations(false);
    }
    setOpen(next);
  }

  function confirm() {
    setUserBanned.mutate(
      {
        userId: user.id,
        banned: !unbanning,
        reason: reason.trim(),
        category: suspending ? (category ?? undefined) : undefined,
        suspendOrganizations: suspending,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <UserBanTrigger banned={user.banned} label={label} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${copy.verb} ${user.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {canSuspend ? (
          <OwnedWorkspacesOption
            checked={suspendOrganizations}
            count={user.ownedOrganizations}
            onCheckedChange={setSuspendOrganizations}
          />
        ) : null}
        <SuspensionFields
          category={category}
          categoryHint="Shown to visitors on the offline page of their sites."
          id="user-ban"
          onCategoryChange={suspending ? setCategory : undefined}
          onReasonChange={setReason}
          reason={reason}
          reasonHint={
            suspending ? BAN_REASON_HINTS.emailed : BAN_REASON_HINTS.auditOnly
          }
          reasonPlaceholder={copy.reasonPlaceholder}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={setUserBanned.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || setUserBanned.isPending}
            onClick={confirm}
            variant={copy.destructive ? "destructive" : "default"}
          >
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UserBanDialog(props: UserBanDialogProps) {
  // The server refuses to ban a Notra admin, so don't offer it.
  if (!props.user.banned && hasAdminRole(props.user.role)) {
    return null;
  }
  return <UserBanDialogInner {...props} />;
}
