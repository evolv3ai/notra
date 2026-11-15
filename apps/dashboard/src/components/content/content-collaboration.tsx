"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import type { ContentCollaborationProps } from "@/types/content/history";
import lazyComponent from "@/utils/lazy-component";

function CollaborationLoading() {
  const t = useTranslations("content.collaboration");
  return (
    <p className="text-muted-foreground px-5 py-4 text-sm" role="status">
      {t("loading")}
    </p>
  );
}

const ContentHistory = lazyComponent(
  () =>
    import("@/components/content/content-history").then((module) => ({
      default: module.ContentHistory,
    })),
  { loading: CollaborationLoading }
);

export function ContentCollaboration(props: ContentCollaborationProps) {
  const t = useTranslations("content.collaboration");
  const [restoring, setRestoring] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const restoredRevision = useRef<number | null>(null);
  const open = props.open;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!restoring) {
          props.onOpenChange(value);
        }
      }}
    >
      <DialogContent className="flex h-[min(88dvh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>{t("history")}</DialogTitle>
          <DialogDescription>{t("historyDescription")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          {open ? (
            <ContentHistory
              {...props}
              active={open}
              onRestoreBusyChange={setRestoring}
              recovery={{ restoredRevision, needsRefresh, setNeedsRefresh }}
              key={props.contentId}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
