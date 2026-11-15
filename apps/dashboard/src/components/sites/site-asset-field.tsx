"use client";

import { Image01Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_IMAGE_UPLOAD_ACCEPT } from "@notra/sites-core/constants/uploads";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Spinner } from "@notra/ui/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { useSiteAssetPreview } from "@/lib/hooks/use-site-asset-preview";
import { useSiteImageUpload } from "@/lib/hooks/use-site-image-upload";
import type { SiteAssetFieldProps } from "@/types/site-design";

export function SiteAssetField({
  id,
  kind,
  label,
  value,
  onChange,
  placeholder,
}: SiteAssetFieldProps) {
  const t = useTranslations("sites.design.asset");
  const upload = useSiteImageUpload(kind, onChange);
  const src = useSiteAssetPreview(value, upload.preview);
  const inputRef = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;
  let uploadHint = value ? t("replace") : t("uploadHint");
  if (upload.uploading) {
    uploadHint = t("uploading");
  }
  let thumbnail = (
    <HugeiconsIcon
      aria-hidden="true"
      className="text-muted-foreground size-3"
      icon={Image01Icon}
    />
  );
  if (showImage) {
    thumbnail = (
      <img
        alt=""
        className="size-full object-contain"
        onError={() => setFailed(src)}
        src={src}
      />
    );
  } else if (upload.enabled) {
    thumbnail = (
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5"
        icon={Upload04Icon}
        strokeWidth={1.8}
      />
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-md transition-shadow",
        upload.dragging && "ring-ring/50 ring-2"
      )}
      {...upload.dropTarget}
    >
      <InputGroup className="w-full">
        <InputGroupAddon>
          {upload.enabled ? (
            <>
              <input
                accept={SITE_IMAGE_UPLOAD_ACCEPT}
                aria-hidden="true"
                className="sr-only"
                onChange={(event) => {
                  void upload.upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
                ref={inputRef}
                tabIndex={-1}
                type="file"
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <InputGroupButton
                      aria-busy={upload.uploading}
                      aria-label={t("uploadLabel", { label })}
                      className="group/thumb relative overflow-hidden"
                      disabled={upload.uploading}
                      onClick={() => inputRef.current?.click()}
                      size="icon-xs"
                      variant="outline"
                    />
                  }
                >
                  {upload.uploading ? (
                    <Spinner className="size-3" />
                  ) : (
                    <>
                      {thumbnail}
                      {showImage ? (
                        <span className="bg-background/80 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100">
                          <HugeiconsIcon
                            aria-hidden="true"
                            className="size-3.5"
                            icon={Upload04Icon}
                            strokeWidth={1.8}
                          />
                        </span>
                      ) : null}
                    </>
                  )}
                </TooltipTrigger>
                <TooltipContent>{uploadHint}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <span className="bg-muted/60 ring-foreground/10 flex size-5 items-center justify-center overflow-hidden rounded-[5px] ring-1">
              {thumbnail}
            </span>
          )}
        </InputGroupAddon>
        <InputGroupInput
          aria-label={label}
          autoComplete="off"
          className="font-mono text-xs"
          id={id}
          maxLength={300}
          onChange={(event) => onChange(event.target.value)}
          onPaste={upload.onPaste}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
        />
      </InputGroup>
    </div>
  );
}
