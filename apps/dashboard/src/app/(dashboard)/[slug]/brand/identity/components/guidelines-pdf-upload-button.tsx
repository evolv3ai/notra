"use client";

import { FileUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useBrandGuidelines } from "@/lib/hooks/use-brand-guidelines";
import { useGuidelinePdfUpload } from "@/lib/hooks/use-guideline-pdf-upload";
import type { GuidelinesPanelProps } from "@/types/brand-identity";
import { hasGeneratedGuidelines } from "@/utils/brand-guideline-pdf";

export function GuidelinesPdfUploadButton({
  organizationId,
  voiceId,
}: GuidelinesPanelProps) {
  const tPdf = useTranslations("brand.guidelines.pdf");
  const { data } = useBrandGuidelines(organizationId, voiceId);
  const { inputProps, isUploading, openPicker } = useGuidelinePdfUpload(
    organizationId,
    voiceId
  );

  if (
    !data?.guideline ||
    data.guideline.sourcePdfFilename ||
    !hasGeneratedGuidelines({
      ...data,
      lastGeneratedAt: data.guideline.lastGeneratedAt,
    })
  ) {
    return null;
  }

  return (
    <>
      <input {...inputProps} />
      <Button loading={isUploading} onClick={openPicker} variant="outline">
        <HugeiconsIcon className="size-4" icon={FileUploadIcon} />
        {tPdf("upload")}
      </Button>
    </>
  );
}
