"use client";

import {
  Download01Icon,
  FloppyDiskIcon,
  SentIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  SplitButton,
  SplitButtonTrigger,
} from "@notra/ui/components/ui/split-button";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentSaveConflict } from "@/components/content/content-save-conflict";
import { DiagramEditorDialog } from "@/components/content/diagram-editor-dialog";
import { ImageExportTargetIcon } from "@/components/content/image-export-target-icon";
import { PostSocialButton } from "@/components/content/post-social-button";
import { ContentPublishButton } from "@/components/content/schedule/content-publish-button";
import { WriterExecute } from "@/components/geo/writer/writer-execute";
import { IMAGE_EXPORT_DOWNLOAD_TARGET } from "@/constants/studio-analytics";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  copyDiagramScene,
  copyImageAsFigma,
  copyImageAsPaper,
  downloadImage,
  preloadImageExportCopy,
} from "@/lib/content/image-export";
import { useIsSavingSocialVideo } from "@/lib/hooks/use-content";
import { usePostSchedule } from "@/lib/hooks/use-content-calendar";
import { cn } from "@/lib/utils";
import type {
  ContentDetailToolbarProps,
  ContentDetailImageActionsProps,
  ContentDetailPublishActionsProps,
  ContentDetailStatusButtonProps,
} from "@/types/components/content-detail-toolbar";
import type { ImageExportTarget } from "@/types/content/image-export";
import {
  getImageExcalidrawUrl,
  getImageExportHtml,
  isHttpImageContent,
} from "@/utils/image-content";
import {
  getAvailableImageExportTargets,
  getImageExportTargetLabel,
  isDiagramExportTarget,
  isImageExportTarget,
} from "@/utils/image-export";

function ContentDetailImageActions({
  content,
  contentId,
  document,
  organizationId,
}: ContentDetailImageActionsProps) {
  const t = useTranslations("content.toolbar");
  const tCommon2 = useTranslations("common");
  const [isCopying, setIsCopying] = useState(false);
  const imageExportHtml = getImageExportHtml(content);
  const imageExportHtmlUrl = content.htmlUrl;
  const imageDownloadUrl = isHttpImageContent(content.content)
    ? content.content
    : null;
  const hasExcalidrawScene = getImageExcalidrawUrl(content) !== null;
  const availableTargets = getAvailableImageExportTargets(hasExcalidrawScene);
  const exportTarget = availableTargets.includes(document.imageExportTarget)
    ? document.imageExportTarget
    : "paper";
  const copyImageExportFor = (target: ImageExportTarget) => {
    if (isCopying) {
      return;
    }
    setIsCopying(true);
    trackEvent(POSTHOG_EVENTS.IMAGE_EXPORTED, {
      content_id: contentId,
      target,
    });
    let copying: Promise<void>;
    if (isDiagramExportTarget(target)) {
      copying = copyDiagramScene(
        `/api/organizations/${organizationId}/content/${contentId}/excalidraw`,
        target
      );
    } else if (target === "figma") {
      copying = copyImageAsFigma(
        document.imageExportRef.current,
        document.title,
        imageExportHtml,
        imageExportHtmlUrl
      );
    } else {
      copying = copyImageAsPaper(
        document.imageExportRef.current,
        imageExportHtml,
        imageExportHtmlUrl
      );
    }
    return copying.finally(() => setIsCopying(false));
  };

  const handleImageExportTargetSelect = (value: string) => {
    if (!isImageExportTarget(value) || value === "wonder") {
      return;
    }
    document.handleImageExportTargetSelect(value);
    preloadImageExportCopy(value);
  };

  return (
    <>
      {hasExcalidrawScene ? (
        <DiagramEditorDialog
          contentId={contentId}
          onSaved={document.invalidateContentQueries}
          organizationId={organizationId}
        />
      ) : null}
      <Button
        onClick={() => {
          trackEvent(POSTHOG_EVENTS.IMAGE_EXPORTED, {
            content_id: contentId,
            target: IMAGE_EXPORT_DOWNLOAD_TARGET,
          });
          downloadImage(imageDownloadUrl, document.title);
        }}
        size="sm"
        variant="outline"
      >
        <HugeiconsIcon className="size-4" icon={Download01Icon} />
        {tCommon2("labels.downloadImage")}
      </Button>
      <SplitButton
        onFocusCapture={() => preloadImageExportCopy(exportTarget)}
        onMouseEnter={() => preloadImageExportCopy(exportTarget)}
      >
        <Button
          loading={isCopying}
          onClick={() => copyImageExportFor(exportTarget)}
          size="sm"
          variant="outline"
        >
          <ImageExportTargetIcon className="size-4" target={exportTarget} />
          {t("copyFor", {
            target: getImageExportTargetLabel(exportTarget),
          })}
        </Button>
        <DropdownMenu>
          <SplitButtonTrigger
            disabled={isCopying}
            label={t("selectExportTarget")}
            size="sm"
            variant="outline"
          />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuRadioGroup
              onValueChange={handleImageExportTargetSelect}
              value={exportTarget}
            >
              {availableTargets.map((target) => {
                const isWonder = target === "wonder";

                return (
                  <DropdownMenuRadioItem
                    className={cn("gap-2", isWonder && "items-start")}
                    closeOnClick
                    disabled={isWonder}
                    key={target}
                    onFocus={() => preloadImageExportCopy(target)}
                    onMouseEnter={() => preloadImageExportCopy(target)}
                    value={target}
                  >
                    <ImageExportTargetIcon
                      className="mt-0.5 size-4"
                      target={target}
                    />
                    <span className="flex flex-col">
                      <span>
                        {t("copyFor", {
                          target: getImageExportTargetLabel(target),
                        })}
                      </span>
                      {isWonder ? (
                        <span className="text-muted-foreground text-xs">
                          {t("comingSoon")}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SplitButton>
    </>
  );
}

function ContentDetailPublishActions({
  content,
  contentId,
  document,
  organizationId,
  organizationSlug,
  videoPending,
}: ContentDetailPublishActionsProps) {
  if (document.isGeoWriterPlanMode) {
    return document.isGeoWriterBriefMissing ? null : <WriterExecute.Button />;
  }
  const hasUnsavedChanges =
    document.hasChanges ||
    document.isSaving ||
    document.hasSaveConflict ||
    videoPending;
  const publishButton = (
    <ContentDetailStatusButton
      content={content}
      document={document}
      hasUnsavedChanges={hasUnsavedChanges}
    />
  );
  return document.isGeoArticleLoading ? (
    publishButton
  ) : (
    <ContentPublishButton
      contentId={contentId}
      contentType={content.contentType}
      hasUnsavedChanges={hasUnsavedChanges}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      publishButton={publishButton}
      published={content.status === "published"}
      title={document.title}
    />
  );
}

function ContentDetailStatusButton({
  content,
  document,
  hasUnsavedChanges,
}: ContentDetailStatusButtonProps) {
  const tCommon2 = useTranslations("common");
  let publishLabel = tCommon2("labels.publish");
  if (document.isTogglingStatus) {
    publishLabel = tCommon2("labels.updating");
  } else if (content.status === "published") {
    publishLabel = tCommon2("labels.moveToDraft");
  }
  return (
    <Button
      disabled={
        document.isTogglingStatus ||
        document.isGeoArticleLoading ||
        hasUnsavedChanges
      }
      onClick={document.handleToggleStatus}
      size="sm"
      variant={content.status === "draft" ? "default" : "outline"}
    >
      <span
        className={
          content.contentType === "blog_post" ||
          content.contentType === "changelog"
            ? "@max-4xl/topbar:sr-only"
            : undefined
        }
      >
        {publishLabel}
      </span>
      <HugeiconsIcon
        className="size-4"
        icon={content.status === "published" ? TextIcon : SentIcon}
      />
    </Button>
  );
}

export function ContentDetailToolbar(props: ContentDetailToolbarProps) {
  if (
    props.content.contentType === "blog_post" ||
    props.content.contentType === "changelog"
  ) {
    return <ContentDetailHeaderActions {...props} />;
  }
  return <ContentDetailStandardActions {...props} />;
}

function ContentDetailStandardActions(props: ContentDetailToolbarProps) {
  const { content, contentId, document, organizationId } = props;
  const [videoUploading, setVideoUploading] = useState(false);
  const videoSaving = useIsSavingSocialVideo(organizationId, contentId);
  const videoPending = videoUploading || videoSaving;
  const { data: scheduleData } = usePostSchedule(organizationId, contentId);
  const socialSendPending = Boolean(
    scheduleData?.schedule?.publications.some(
      (publication) =>
        publication.destination === "social" &&
        (publication.status === "scheduled" ||
          publication.status === "publishing")
    )
  );
  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <ContentSaveConflict document={document} />
      <ContentDetailSaveActions {...props} />
      {content.contentType === "image" ? (
        <ContentDetailImageActions {...props} />
      ) : (
        <ContentDetailPublishActions {...props} videoPending={videoPending} />
      )}
      {(content.contentType === "linkedin_post" ||
        content.contentType === "twitter_post") &&
      !socialSendPending ? (
        <PostSocialButton
          content={document.currentMarkdown}
          contentId={props.contentId}
          from="editor"
          initialVideo={content.sourceMetadata?.socialVideo ?? null}
          onContentChange={document.setEditedMarkdown}
          onUploadingChange={setVideoUploading}
          organizationId={organizationId}
          platform={
            content.contentType === "linkedin_post" ? "linkedin" : "twitter"
          }
        />
      ) : null}
    </div>
  );
}

function ContentDetailSaveActions({
  content,
  document,
}: Pick<ContentDetailToolbarProps, "content" | "document">) {
  const t = useTranslations("content.toolbar");
  const tCommon = useTranslations("common.actions");
  const updatesLinkedPullRequest = Boolean(content.githubPublish);
  let saveLabel = tCommon("saveChanges");
  if (content.githubPublish?.pullRequestNumber) {
    saveLabel = document.isSaving ? t("updatingPr") : t("saveAndUpdatePr");
  } else if (document.isSaving) {
    saveLabel = tCommon("saving");
  }
  if (
    !document.hasChanges ||
    document.hasSaveConflict ||
    !(
      updatesLinkedPullRequest ||
      document.saveFailed ||
      document.reviewPreviousMarkdown
    )
  ) {
    return null;
  }
  return (
    <>
      {document.hasDocumentChanges ? (
        <Button
          disabled={document.isSaving}
          onClick={document.handleDiscard}
          size="sm"
          variant="ghost"
        >
          {t("discardChanges")}
        </Button>
      ) : null}
      <Button
        aria-keyshortcuts="Meta+S Control+S"
        data-save-bar
        disabled={document.isSaving}
        onClick={() => {
          void document.handleSave();
        }}
        size="sm"
        variant="outline"
      >
        {saveLabel}
      </Button>
    </>
  );
}

function ContentDetailHeaderActions(props: ContentDetailToolbarProps) {
  const { content, document } = props;
  const t = useTranslations("content.toolbar");
  const tActions = useTranslations("common.actions");
  const tHeader = useTranslations("content.header");
  const manualSave =
    document.hasChanges &&
    Boolean(
      content.githubPublish ||
      document.saveFailed ||
      document.reviewPreviousMarkdown
    );
  const blocked = document.isSaving || document.isGeoArticleLoading;
  let status = tHeader("saved");
  if (document.isSaving) {
    status = tActions("saving");
  } else if (document.hasChanges) {
    status = tHeader("unsaved");
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ContentSaveConflict document={document} />
      {!document.hasSaveConflict && manualSave ? (
        <Button
          aria-keyshortcuts="Meta+S Control+S"
          data-save-bar
          disabled={blocked}
          onClick={() => {
            void document.handleSave();
          }}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon aria-hidden="true" icon={FloppyDiskIcon} />
          <span className="@max-4xl/topbar:sr-only">
            {content.githubPublish?.pullRequestNumber
              ? t("saveAndUpdatePr")
              : tActions("saveChanges")}
          </span>
        </Button>
      ) : null}
      {!document.hasSaveConflict && !manualSave ? (
        <span aria-live="polite" className="sr-only">
          {status}
        </span>
      ) : null}
      <ContentDetailPublishActions {...props} videoPending={false} />
    </div>
  );
}
