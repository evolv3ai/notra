"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@notra/ui/components/ui/alert-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type {
  ContentSaveConflictProps,
  ContentSaveConflictResolution,
} from "@/types/content/history";

export function ContentSaveConflict({ document }: ContentSaveConflictProps) {
  const t = useTranslations("content.collaboration");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<ContentSaveConflictResolution | null>(
    null
  );
  const [resolving, setResolving] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = resolving || document.isSaving;

  const resolve = async (resolution: ContentSaveConflictResolution) => {
    setResolving(true);
    setFailed(false);
    const succeeded =
      resolution === "saveMine"
        ? await document.resolveSaveConflictSaveMine()
        : await document.resolveSaveConflictLoadLatest();
    setFailed(!succeeded);
    if (succeeded) {
      setConfirm(null);
      setOpen(false);
    }
    setResolving(false);
  };

  if (!document.hasSaveConflict) {
    return null;
  }

  return (
    <>
      <Popover
        onOpenChange={(value) => {
          setFailed(false);
          setOpen(value);
        }}
        open={open}
      >
        <PopoverTrigger
          render={
            <Badge
              render={<button type="button" />}
              shape="rounded"
              size="md"
              variant="warning"
            />
          }
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Alert02Icon}
            strokeWidth={2}
          />
          <span className="@max-3xl/topbar:sr-only">{t("conflictTitle")}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <PopoverHeader>
            <PopoverTitle>{t("conflictTitle")}</PopoverTitle>
            <PopoverDescription>{t("saveConflict")}</PopoverDescription>
          </PopoverHeader>
          {failed ? (
            <p className="text-destructive text-sm text-pretty" role="alert">
              {t("conflictFailed")}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Button
              disabled={busy}
              onClick={() => setConfirm("saveMine")}
              size="sm"
              variant="outline"
            >
              {t("saveMine")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setConfirm("loadLatest")}
              size="sm"
              variant="ghost"
            >
              {t("loadLatest")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog
        onOpenChange={(value) => {
          if (!(value || busy)) {
            setConfirm(null);
          }
        }}
        open={confirm !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                confirm === "loadLatest" ? "loadLatestTitle" : "saveMineTitle"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirm === "loadLatest"
                  ? "loadLatestDescription"
                  : "saveMineDescription"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {failed ? (
            <p className="text-destructive text-sm text-pretty" role="alert">
              {t("conflictFailed")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <Button
              disabled={busy}
              loading={resolving}
              onClick={() => {
                if (confirm) {
                  void resolve(confirm);
                }
              }}
              variant={confirm === "loadLatest" ? "destructive" : "default"}
            >
              {t(confirm === "loadLatest" ? "loadLatest" : "saveMine")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
