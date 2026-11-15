"use client";

import {
  ArrowReloadHorizontalIcon,
  Delete02Icon,
  ImageUploadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POST_COVER_ALT_MAX_LENGTH } from "@notra/ai/constants/post-metadata";
import { postCoverImageSchema } from "@notra/ai/schemas/post-metadata";
import { Input } from "@notra/ui/components/ui/input";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { cn } from "@notra/ui/lib/utils";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  CONTENT_COVER_HEIGHT,
  CONTENT_COVER_WIDTH,
} from "@/constants/content-overview";
import { uploadContentMedia } from "@/lib/upload/client";
import type {
  CoverSource,
  OverviewCoverFieldProps,
} from "@/types/content/overview";
import { coverCandidatesInMarkdown } from "@/utils/content-metadata";
import { toErrorMessage } from "@/utils/error-message";

export function OverviewCoverField({ api, markdown }: OverviewCoverFieldProps) {
  const t = useTranslations("content.overview.cover");
  const inputRef = useRef<HTMLInputElement>(null);
  const altId = useId();
  const [source, setSource] = useState<CoverSource>("upload");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState("");
  const postImages = useMemo(
    () => coverCandidatesInMarkdown(markdown),
    [markdown]
  );
  const cover = api.metadata.coverImage;

  const upload = async (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) {
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadContentMedia(
        file,
        "image",
        t("uploadFailed")
      );
      api.update({ coverImage: { url, alt: cover?.alt ?? "" } });
    } catch (error) {
      toast.error(toErrorMessage(error, t("uploadFailed")));
    }
    setUploading(false);
  };

  const fileInput = (
    <input
      accept="image/*"
      aria-label={t("upload")}
      className="sr-only"
      onChange={(event) => {
        void upload(event.target.files?.[0]);
        event.target.value = "";
      }}
      ref={inputRef}
      tabIndex={-1}
      type="file"
    />
  );

  if (cover) {
    return (
      <div className="space-y-2">
        {fileInput}
        <div className="group/cover relative">
          <img
            alt={cover.alt}
            className="aspect-[1200/630] w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
            src={cover.url}
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within/cover:opacity-100 group-hover/cover:opacity-100 pointer-coarse:opacity-100">
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
              {t("replace")}
            </Button>
            <Button
              aria-label={t("remove")}
              disabled={uploading}
              onClick={() => api.update({ coverImage: null })}
              size="icon-xs"
              variant="secondary"
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label
            className="text-muted-foreground shrink-0 text-xs"
            htmlFor={altId}
          >
            {t("altLabel")}
          </label>
          <input
            className="placeholder:text-muted-foreground/70 hover:bg-muted/60 focus-visible:bg-muted/60 min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-xs outline-none"
            id={altId}
            maxLength={POST_COVER_ALT_MAX_LENGTH}
            onChange={(event) =>
              api.updateDebounced({
                coverImage: { url: cover.url, alt: event.target.value },
              })
            }
            placeholder={t("altPlaceholder")}
            value={cover.alt}
          />
        </div>
      </div>
    );
  }

  const applyLink = () => {
    const parsed = postCoverImageSchema.safeParse({ url: link, alt: "" });
    if (!(parsed.success && parsed.data.url.startsWith("https://"))) {
      toast.error(t("linkInvalid"));
      return;
    }
    api.update({ coverImage: parsed.data });
    setLink("");
  };

  return (
    <div className="space-y-2">
      {fileInput}
      <Tabs
        onValueChange={(value) => setSource(value as CoverSource)}
        value={source}
      >
        <TabsList aria-label={t("label")} className="w-full">
          <TabsTrigger value="upload">{t("upload")}</TabsTrigger>
          <TabsTrigger value="link">{t("link")}</TabsTrigger>
          <TabsTrigger value="post">{t("fromPost")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {source === "upload" ? (
        <button
          className={cn(
            "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground flex aspect-[1200/630] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm transition-colors disabled:cursor-progress",
            dragging && "border-ring bg-muted/60 text-foreground"
          )}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void upload(event.dataTransfer.files[0]);
          }}
          onPaste={(event) => {
            void upload(event.clipboardData.files[0]);
          }}
          type="button"
        >
          {uploading ? (
            <>
              <Spinner className="size-5" />
              <span>{t("uploading")}</span>
            </>
          ) : (
            <>
              <HugeiconsIcon
                className="size-5"
                icon={ImageUploadIcon}
                strokeWidth={1.6}
              />
              <span className="text-foreground font-medium">
                {t("dropTitle")}
              </span>
              <span className="text-xs">
                {t("dropHint", {
                  width: CONTENT_COVER_WIDTH,
                  height: CONTENT_COVER_HEIGHT,
                })}
              </span>
            </>
          )}
        </button>
      ) : null}
      {source === "link" ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            aria-label={t("link")}
            inputMode="url"
            onChange={(event) => setLink(event.target.value)}
            placeholder={t("linkPlaceholder")}
            value={link}
          />
          <Button disabled={!link.trim()} type="submit" variant="secondary">
            {t("linkApply")}
          </Button>
        </form>
      ) : null}
      {source === "post" ? (
        postImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {postImages.map((url) => (
              <button
                aria-label={t("pickImage")}
                className="focus-visible:ring-ring cursor-pointer overflow-hidden rounded-lg outline outline-1 -outline-offset-1 outline-black/10 transition-opacity hover:opacity-80 focus-visible:ring-2 dark:outline-white/10"
                key={url}
                onClick={() => api.update({ coverImage: { url, alt: "" } })}
                type="button"
              >
                <img
                  alt=""
                  className="aspect-[1200/630] w-full object-cover"
                  src={url}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground border-border rounded-xl border border-dashed px-3 py-6 text-center text-sm">
            {t("noPostImages")}
          </p>
        )
      ) : null}
    </div>
  );
}
