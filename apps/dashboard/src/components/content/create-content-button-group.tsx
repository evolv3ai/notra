"use client";

import {
  AiMagicIcon,
  NoteAddIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { CreateContentButtonGroupProps } from "@/types/content/create-post";

export function CreateContentButtonGroup({
  disabled = false,
  onCreateContent,
  onCreatePost,
  onCreateArticle,
  onPrefetchCreateContent,
  onPrefetchCreatePost,
  onPrefetchCreateArticle,
}: CreateContentButtonGroupProps) {
  const t = useTranslations("content.create.buttons");
  const tCommon = useTranslations("common");
  return (
    <div className="grid grid-cols-[max-content_max-content] items-center gap-2 sm:flex sm:flex-wrap">
      <Button
        disabled={disabled}
        onClick={onCreatePost}
        onFocus={onPrefetchCreatePost}
        onMouseEnter={onPrefetchCreatePost}
        variant="outline"
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4"
          icon={NoteAddIcon}
        />
        {tCommon("labels.newPost")}
      </Button>
      {onCreateArticle ? (
        <Button
          disabled={disabled}
          onClick={onCreateArticle}
          onFocus={onPrefetchCreateArticle}
          onMouseEnter={onPrefetchCreateArticle}
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={PencilEdit01Icon}
          />
          {t("writeArticle")}
        </Button>
      ) : null}
      <Button
        className="col-span-2 col-start-1 row-start-2 justify-self-start"
        disabled={disabled}
        onClick={onCreateContent}
        onFocus={onPrefetchCreateContent}
        onMouseEnter={onPrefetchCreateContent}
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4"
          icon={AiMagicIcon}
        />
        {t("generateContent")}
        <Kbd className="hidden sm:inline-flex">C</Kbd>
      </Button>
    </div>
  );
}
