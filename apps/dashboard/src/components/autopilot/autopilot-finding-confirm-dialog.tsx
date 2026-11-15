"use client";

import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotFindingConfirmDialogProps } from "@/types/autopilot";
import { toErrorMessage } from "@/utils/error-message";

/**
 * Confirms closing a pull request or idea, and merging from a Slack link.
 * Merges on the page go through the merge menu instead.
 */
export function AutopilotFindingConfirmDialog({
  organizationId,
  pending,
  branch,
  onClose,
}: AutopilotFindingConfirmDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const confirm = async () => {
    if (!pending) {
      return;
    }
    try {
      if (pending.kind === "merge") {
        await dashboardOrpc.autopilot.merge.call({
          organizationId,
          findingId: pending.finding.id,
        });
        toast.success("Merged");
      } else {
        const result = await dashboardOrpc.autopilot.dismiss.call({
          organizationId,
          findingId: pending.finding.id,
          reason: reason.trim() || undefined,
        });
        toast.success(
          result.rule
            ? `Closed. Autopilot will remember: "${result.rule}"`
            : "Closed. Autopilot won't suggest this again."
        );
      }
      onClose();
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
    } catch (error) {
      toast.error(toErrorMessage(error, "Something went wrong"));
    }
  };

  return (
    <ConfirmDialog
      confirmLabel={pending?.kind === "merge" ? "Merge" : "Close"}
      description={
        pending?.kind === "merge"
          ? `This merges ${pending.finding.repository}#${pending.finding.pullRequestNumber} into ${branch ?? "your default branch"}.`
          : pending?.finding.pullRequestUrl
            ? "This closes the pull request. Autopilot won't suggest it again."
            : "Autopilot won't suggest this again."
      }
      onConfirm={confirm}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setReason("");
        }
      }}
      open={pending !== null}
      title={pending?.finding.title ?? ""}
      variant={pending?.kind === "dismiss" ? "destructive" : "default"}
    >
      {pending?.kind === "dismiss" ? (
        <Textarea
          aria-label="Why? (optional)"
          maxLength={300}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why? (optional) Autopilot remembers it for similar posts."
          rows={3}
          value={reason}
        />
      ) : null}
    </ConfirmDialog>
  );
}
