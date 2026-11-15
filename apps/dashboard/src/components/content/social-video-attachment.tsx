"use client";

import {
  ArrowReloadHorizontalIcon,
  Delete02Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentVideoPlayer } from "@/components/content/editor/nodes/content-video-player";
import { SOCIAL_VIDEO } from "@/constants/social-video";
import { trackSocialVideoUpload } from "@/lib/hooks/use-social-video-pending";
import { uploadFile } from "@/lib/upload/client";
import { cn } from "@/lib/utils";
import type { SocialVideoAttachmentProps } from "@/types/content/post-social";
import { validateContentVideo } from "@/utils/validate-content-video";

export function SocialVideoAttachment({
  value,
  onChange,
  disabled,
  contentId,
  onUploadingChange,
}: SocialVideoAttachmentProps) {
  const t = useTranslations("content.postSocial");
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const setUploadingState = (next: boolean) => {
    setUploading(next);
    onUploadingChange?.(next);
  };

  const handleFile = async (file: File) => {
    if (disabled || busyRef.current) {
      return;
    }
    setError(null);
    if (file.size > SOCIAL_VIDEO.maxBytes) {
      setError(t("videoTooLarge", { maxMb: SOCIAL_VIDEO.maxBytesMb }));
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }
    busyRef.current = true;
    const finishTracking = contentId
      ? trackSocialVideoUpload(contentId)
      : undefined;
    setUploadingState(true);
    try {
      const mimeType = validateContentVideo(
        new Uint8Array(await file.arrayBuffer())
      );
      const normalized =
        file.type === mimeType
          ? file
          : new File([file], file.name, { type: mimeType });
      const { url, key } = await uploadFile({
        file: normalized,
        type: "content",
      });
      onChange({ key, url, mimeType, size: file.size });
    } catch (cause) {
      toast.error(t("videoUploadFailed"));
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : t("videoUploadFailed")
      );
    } finally {
      busyRef.current = false;
      finishTracking?.();
      setUploadingState(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const fileInput = (
    <input
      accept={SOCIAL_VIDEO.accept}
      aria-hidden
      className="sr-only"
      disabled={disabled || uploading}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          void handleFile(file);
        }
      }}
      ref={inputRef}
      tabIndex={-1}
      type="file"
    />
  );
  const errorNotice = error ? (
    <p className="text-destructive text-sm">{error}</p>
  ) : null;

  if (value) {
    return (
      <div className="space-y-1.5">
        {fileInput}
        <div className="group/video relative">
          <ContentVideoPlayer
            key={value.url}
            src={value.url}
            videoClassName="max-h-56"
          />
          {disabled ? null : (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within/video:opacity-100 group-hover/video:opacity-100 pointer-coarse:opacity-100">
              <Button
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                size="xs"
                variant="secondary"
              >
                {uploading ? (
                  <Spinner className="size-3" />
                ) : (
                  <HugeiconsIcon
                    icon={ArrowReloadHorizontalIcon}
                    strokeWidth={1.8}
                  />
                )}
                {t("replaceVideo")}
              </Button>
              <Button
                aria-label={t("removeVideo")}
                disabled={uploading}
                onClick={() => onChange(null)}
                size="icon-xs"
                variant="secondary"
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.8} />
              </Button>
            </div>
          )}
        </div>
        {errorNotice}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {fileInput}
      <button
        className={cn(
          "bg-card ring-foreground/10 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left ring-1 transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60",
          uploading && "cursor-progress",
          dragging && "ring-ring bg-muted/60 text-foreground"
        )}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) {
            void handleFile(file);
          }
        }}
        type="button"
      >
        <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          {uploading ? (
            <Spinner className="size-4" />
          ) : (
            <HugeiconsIcon
              className="size-4"
              icon={Video01Icon}
              strokeWidth={1.8}
            />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-foreground text-sm font-medium">
            {uploading ? t("uploadingVideo") : t("attachVideo")}
          </span>
          <span className="text-xs">
            {t("attachVideoHint", { maxMb: SOCIAL_VIDEO.maxBytesMb })}
          </span>
        </span>
      </button>
      {errorNotice}
    </div>
  );
}
