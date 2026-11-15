"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteGeoReportAction } from "@/lib/geo-reports/actions";
import type { DeleteReportDialogProps } from "@/types/geo-report";

export function DeleteReportDialog({
  slug,
  reportId,
  companyName,
  onDeleted,
  size = "sm",
}: DeleteReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteGeoReportAction({ slug, id: reportId }).catch(
        () => ({
          error: { message: "Could not delete the report. Please try again." },
        })
      );
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success("Report deleted");
      onDeleted();
    });
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={<Button size={size} variant="ghost" />}>
        <HugeiconsIcon icon={Delete02Icon} />
        {size === "icon-sm" ? (
          <span className="sr-only">Delete report</span>
        ) : (
          "Delete"
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this report?</AlertDialogTitle>
          <AlertDialogDescription>
            {companyName ? `The ${companyName} report` : "This report"} and its
            share link stop working right away. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={confirm}
            variant="destructive"
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
