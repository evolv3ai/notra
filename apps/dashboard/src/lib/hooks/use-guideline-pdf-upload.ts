"use client";

import {
  BRAND_GUIDELINE_PDF_FILENAME_MAX_LENGTH,
  BRAND_GUIDELINE_PDF_MIME_TYPE,
  MAX_BRAND_GUIDELINE_PDF_FILE_SIZE,
} from "@notra/schemas/constants/dashboard/upload";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useAttachGuidelineSourcePdf } from "@/lib/hooks/use-brand-guidelines";
import { uploadFile } from "@/lib/upload/client";
import { isPdfFile } from "@/utils/brand-guideline-pdf";

export function useGuidelinePdfUpload(organizationId: string, voiceId: string) {
  const tPdf = useTranslations("brand.guidelines.pdf");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const attach = useAttachGuidelineSourcePdf(organizationId, voiceId);
  const maxMb = MAX_BRAND_GUIDELINE_PDF_FILE_SIZE / 1024 / 1024;

  const upload = async (file: File) => {
    const filename = file.name.trim();
    if (!isPdfFile(file)) {
      toast.error(tPdf("notPdf"));
      return;
    }
    if (file.size > MAX_BRAND_GUIDELINE_PDF_FILE_SIZE) {
      toast.error(tPdf("tooLarge", { maxMb }));
      return;
    }
    if (
      filename.length === 0 ||
      filename.length > BRAND_GUIDELINE_PDF_FILENAME_MAX_LENGTH
    ) {
      toast.error(tPdf("badFilename"));
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadFile({
        file:
          file.type === BRAND_GUIDELINE_PDF_MIME_TYPE
            ? file
            : new File([file], file.name, {
                type: BRAND_GUIDELINE_PDF_MIME_TYPE,
              }),
        type: "brand_guideline_pdf",
      });
      await attach.mutateAsync({ filename, key: uploaded.key });
      toast.success(tPdf("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tPdf("saveFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      upload(file).catch(() => undefined);
    }
  };

  return {
    inputProps: {
      accept: BRAND_GUIDELINE_PDF_MIME_TYPE,
      "aria-label": tPdf("uploadLabel"),
      className: "sr-only",
      onChange: onInputChange,
      ref: inputRef,
      type: "file",
    } as const,
    isUploading: isUploading || attach.isPending,
    openPicker: () => inputRef.current?.click(),
  };
}
