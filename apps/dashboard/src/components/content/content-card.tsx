"use client";

import {
  Delete02Icon,
  MoreVerticalIcon,
  SentIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { BlogPostSubtype } from "@notra/db/types/content";
import { Badge } from "@notra/ui/components/ui/badge";
import { Button } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { memo, useState } from "react";
import { useTranslations } from "use-intl";

import { ContentDeleteDialog } from "@/components/content/content-delete-dialog";
import Image from "@/components/framework/image";
import Link from "@/components/framework/link";
import { useBlogPostSubtypeLabels } from "@/lib/hooks/use-blog-post-subtype-labels";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { cn } from "@/lib/utils";
import type { ContentCardProps } from "@/types/content/card";
import { isBlogPostSubtype } from "@/utils/content-subtype";
import { formatSnakeCaseLabel } from "@/utils/format";
import { OutputTypeIcon } from "@/utils/output-types";

function getContentSubtypeLabel(
  contentSubtype: string | null | undefined,
  subtypeLabel: (subtype: BlogPostSubtype) => string
): string | null {
  if (!contentSubtype) {
    return null;
  }
  return isBlogPostSubtype(contentSubtype)
    ? subtypeLabel(contentSubtype)
    : formatSnakeCaseLabel(contentSubtype);
}

function ContentCardEmptyPreview() {
  const t = useTranslations("content.card");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 pt-2 pb-4 text-center">
      <span
        aria-hidden="true"
        className="relative isolate flex size-8 items-center justify-center"
      >
        <span className="border-border/60 bg-card absolute inset-0 -z-10 origin-bottom-left -translate-x-1 scale-85 -rotate-10 rounded-md border" />
        <span className="border-border/60 bg-card absolute inset-0 -z-10 origin-bottom-right translate-x-1 scale-85 rotate-10 rounded-md border" />
        <span className="border-border/80 bg-card text-foreground relative flex size-8 items-center justify-center rounded-md border shadow-xs">
          <HugeiconsIcon className="size-4" icon={TextIcon} />
        </span>
      </span>
      <p className="text-muted-foreground text-xs font-medium">
        {t("nothingWritten")}
      </p>
    </div>
  );
}

function renderCardPreview({
  hasImagePreview,
  imagePreviewSrc,
  isEmptyDocument,
  previewText,
  title,
}: {
  hasImagePreview: boolean;
  imagePreviewSrc?: string | null;
  isEmptyDocument: boolean;
  previewText: string;
  title: string;
}) {
  if (hasImagePreview && imagePreviewSrc) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden px-3 pb-3">
        <Image
          alt={title}
          className="h-full max-h-full w-full rounded-md object-contain"
          height={630}
          src={imagePreviewSrc}
          unoptimized
          width={1200}
        />
      </div>
    );
  }

  if (isEmptyDocument) {
    return <ContentCardEmptyPreview />;
  }

  return (
    <p className="text-muted-foreground line-clamp-3 [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)] px-3 pb-3 text-sm wrap-anywhere">
      {previewText}
    </p>
  );
}

const ContentCard = memo(function ContentCard({
  id,
  title,
  preview,
  contentType,
  contentSubtype,
  status,
  organizationId,
  className,
  href,
  imagePreviewSrc,
}: ContentCardProps) {
  const t = useTranslations("content.card");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const subtypeLabels = useBlogPostSubtypeLabels();
  const subtypeLabel = getContentSubtypeLabel(
    contentSubtype,
    (subtype) => subtypeLabels[subtype]
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deletePost, isDeleting, isTogglingStatus, togglePostStatus } =
    usePostActions(organizationId);

  async function handleDelete(remove: boolean) {
    const deleted = await deletePost(id, remove);
    if (deleted) {
      setShowDeleteDialog(false);
    }
  }

  const hasImagePreview = contentType === "image" && Boolean(imagePreviewSrc);
  const previewText = preview.trim();
  const isEmptyDocument = !(hasImagePreview || previewText);

  const cardContent = (
    <div
      className={cn(
        "group border-border/80 border-b-border/40 bg-muted/80 relative flex flex-col gap-1.5 rounded-xl border p-1.5 shadow-2xs",
        "h-full transition-colors",
        href && "hover:border-border cursor-pointer",
        className
      )}
    >
      {href ? (
        <Link
          href={href}
          aria-label={title}
          className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
        />
      ) : null}
      <div className="border-border/60 bg-background flex min-h-28 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
          <p className="line-clamp-2 min-w-0 text-sm leading-snug font-medium wrap-anywhere">
            {title}
          </p>
          <div className="relative z-20 flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="text-muted-foreground hover:text-foreground -mt-0.5 -mr-1 size-7 p-0"
                    variant="ghost"
                  >
                    <span className="sr-only">
                      {tCommon2("labels.openMenu")}
                    </span>
                    <HugeiconsIcon className="size-4" icon={MoreVerticalIcon} />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={isTogglingStatus}
                  onClick={() => {
                    togglePostStatus(id, status);
                  }}
                >
                  <HugeiconsIcon
                    className="mr-2 size-4"
                    icon={status === "published" ? TextIcon : SentIcon}
                  />
                  {status === "published"
                    ? tCommon2("labels.moveToDraft")
                    : tCommon2("labels.publish")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteDialog(true);
                  }}
                  variant="destructive"
                >
                  <HugeiconsIcon className="mr-2 size-4" icon={Delete02Icon} />
                  {tCommon("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {renderCardPreview({
          hasImagePreview,
          imagePreviewSrc,
          isEmptyDocument,
          previewText,
          title,
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
        <Badge variant={status === "published" ? "default" : "outline"}>
          {t("status", { status })}
        </Badge>
        <Badge className="flex items-center gap-1" variant="secondary">
          <OutputTypeIcon className="size-3" outputType={contentType} />
          {t("type", {
            type: contentType,
            fallback: formatSnakeCaseLabel(contentType),
          })}
        </Badge>
        {subtypeLabel ? <Badge variant="outline">{subtypeLabel}</Badge> : null}
      </div>
    </div>
  );

  return (
    <>
      {cardContent}

      <ContentDeleteDialog
        contentId={id}
        organizationId={organizationId}
        onConfirm={handleDelete}
        onOpenChange={setShowDeleteDialog}
        open={showDeleteDialog}
        pending={isDeleting}
        title={title}
      />
    </>
  );
});

export { ContentCard };
