"use client";

import {
  Delete02Icon,
  File01Icon,
  FileSyncIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BRAND_GUIDELINE_PDF_MIME_TYPE } from "@notra/schemas/constants/dashboard/upload";
import { useState } from "react";
import { toast } from "sonner";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { AttachmentPreviewDialog } from "@/components/chat/attachment-preview";
import { useRemoveGuidelineSourcePdf } from "@/lib/hooks/use-brand-guidelines";
import { useGuidelinePdfUpload } from "@/lib/hooks/use-guideline-pdf-upload";
import type { GuidelinesSourcePdfSectionProps } from "@/types/brand-identity";
import { latest } from "@/utils/latest-date";

export function GuidelinesSourcePdfSection({
  guideline,
  organizationId,
  voiceId,
}: GuidelinesSourcePdfSectionProps) {
  const tPdf = useTranslations("brand.guidelines.pdf");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { inputProps, isUploading, openPicker } = useGuidelinePdfUpload(
    organizationId,
    voiceId
  );
  const remove = useRemoveGuidelineSourcePdf(organizationId, voiceId);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const filename = guideline?.sourcePdfFilename;

  if (!filename) {
    return null;
  }

  const isBusy = isUploading || remove.isPending;
  const uploadedAt = guideline.sourcePdfUploadedAt;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <HugeiconsIcon
        className="text-muted-foreground size-4 shrink-0"
        icon={File01Icon}
      />
      {guideline.sourcePdfUrl ? (
        <button
          className="truncate text-sm font-medium underline-offset-4 hover:underline"
          onClick={() => setIsPreviewOpen(true)}
          type="button"
        >
          {filename}
        </button>
      ) : (
        <span className="truncate text-sm font-medium">{filename}</span>
      )}
      {uploadedAt ? (
        <span className="text-muted-foreground hidden truncate text-xs sm:inline">
          {tPdf("uploadedAt", {
            time: format.relativeTime(
              new Date(uploadedAt),
              latest(now, uploadedAt)
            ),
          })}
        </span>
      ) : null}
      <input {...inputProps} />
      <div className="flex shrink-0 items-center">
        <Button
          aria-label={tPdf("replace")}
          disabled={isBusy}
          loading={isUploading}
          onClick={openPicker}
          size="icon-xs"
          variant="ghost"
        >
          <HugeiconsIcon className="size-3.5" icon={FileSyncIcon} />
        </Button>
        <Button
          aria-label={tPdf("remove", { filename })}
          disabled={isBusy}
          onClick={() => {
            remove.mutate(undefined, {
              onError: (error) => {
                toast.error(
                  error instanceof Error ? error.message : tPdf("removeFailed")
                );
              },
              onSuccess: () => {
                toast.success(tPdf("removed"));
              },
            });
          }}
          size="icon-xs"
          variant="ghost"
        >
          <HugeiconsIcon className="size-3.5" icon={Delete02Icon} />
        </Button>
      </div>
      <AttachmentPreviewDialog
        attachment={
          guideline.sourcePdfUrl
            ? {
                filename,
                mediaType: BRAND_GUIDELINE_PDF_MIME_TYPE,
                url: guideline.sourcePdfUrl,
              }
            : null
        }
        onOpenChange={setIsPreviewOpen}
        open={isPreviewOpen}
      />
    </div>
  );
}
