"use client";

import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Switch } from "@notra/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useGitHubContentPublishing } from "@/hooks/use-github-content-publishing";
import type {
  GitHubContentPublishingSettingsProps,
  GitHubPublishingSettingsProps,
} from "@/types/integrations/github";

import { GitHubDirectoryPicker } from "./github-directory-picker";
import { GitHubPublishingPathFields } from "./github-publishing-path-fields";
import { GitHubReviewProcess } from "./github-review-process";
import { GitHubSettingRow } from "./github-setting-row";

function GitHubContentPublishingSettings({
  disabled = false,
  ...props
}: GitHubContentPublishingSettingsProps) {
  const { contentType, organizationId, repository } = props;
  const t = useTranslations("integrations.github");
  const tCommon = useTranslations("common");
  const folderTriggerId = useId();
  const publishingSwitchId = useId();
  const editorId = useId();
  const locationId = useId();
  const publishing = useGitHubContentPublishing(props);
  const { directoryQuery } = publishing;
  const repositoryName = `${repository.owner}/${repository.repo}`;

  return (
    <div className="min-w-0">
      <GitHubSettingRow
        htmlFor={publishingSwitchId}
        title={t("contentTypes.label", { type: contentType })}
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="min-w-0 truncate font-mono text-xs"
              id={locationId}
              title={
                publishing.loadFailed || directoryQuery.isLoading
                  ? undefined
                  : publishing.location
              }
            >
              {publishing.loadFailed && (
                <span className="text-destructive" role="alert">
                  {t("publishing.loadFolderFailed", { type: contentType })}
                </span>
              )}
              {!directoryQuery.isLoading &&
                !publishing.loadFailed &&
                publishing.location}
            </span>
            {publishing.showUnsavedChanges ? (
              <span className="text-badge-warning text-xs">
                {t("publishing.unsavedChanges")}
              </span>
            ) : null}
          </span>
        }
      >
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-controls={editorId}
                  aria-describedby={locationId}
                  aria-expanded={publishing.editing}
                  aria-label={t("publishing.editPathsAriaLabel", {
                    type: contentType,
                  })}
                  className="text-muted-foreground"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={publishing.toggleEditor}
                />
              }
            >
              <HugeiconsIcon className="size-4" icon={PencilEdit01Icon} />
            </TooltipTrigger>
            <TooltipContent>{t("publishing.editPaths")}</TooltipContent>
          </Tooltip>
          <Switch
            id={publishingSwitchId}
            aria-label={t("publishing.publishAriaLabel", {
              type: contentType,
              repository: repositoryName,
            })}
            checked={publishing.publishingEnabled}
            disabled={disabled}
            onCheckedChange={publishing.setPublishingEnabled}
          />
        </div>
      </GitHubSettingRow>

      <div
        className="bg-muted/40 mx-4 mb-3 max-w-2xl space-y-4 rounded-lg border p-3"
        hidden={!publishing.editing}
        id={editorId}
      >
        <Field>
          <FieldLabel htmlFor={folderTriggerId}>
            {t("pathFields.folder")}
          </FieldLabel>
          {publishing.loadFailed ? (
            <div
              className="border-destructive/30 flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3"
              role="alert"
            >
              <p className="text-destructive text-sm">
                {t("publishing.loadFolderFailed", { type: contentType })}
              </p>
              <Button
                onClick={() => directoryQuery.refetch()}
                size="sm"
                type="button"
                variant="ghost"
              >
                {tCommon("actions.retry")}
              </Button>
            </div>
          ) : (
            <GitHubDirectoryPicker
              contentType={contentType}
              directory={publishing.directory}
              disabled={disabled || directoryQuery.isLoading}
              isSaving={publishing.isSavingDirectory}
              key={repository.id}
              onSave={publishing.saveDirectory}
              organizationId={organizationId}
              repositoryId={repository.id}
              repositoryName={repositoryName}
              triggerId={folderTriggerId}
            />
          )}
        </Field>

        {directoryQuery.data ? (
          <GitHubReviewProcess
            organizationId={organizationId}
            repository={repository}
            contentType={contentType}
            disabled={disabled}
            config={directoryQuery.data}
          />
        ) : null}
        <GitHubPublishingPathFields
          contentPath={publishing.contentPath}
          directory={publishing.directory}
          disabled={
            disabled || directoryQuery.isLoading || publishing.loadFailed
          }
          imagePath={publishing.imagePath}
          isSaving={publishing.isSavingPaths}
          key={publishing.pathFieldsKey}
          onCancel={publishing.closeEditor}
          onDirtyChange={publishing.changeDraft}
          onSave={publishing.savePaths}
        />
      </div>
    </div>
  );
}

export function GitHubPublishingSettings(props: GitHubPublishingSettingsProps) {
  return (
    <>
      <GitHubContentPublishingSettings {...props} contentType="changelog" />
      <GitHubContentPublishingSettings {...props} contentType="blog_post" />
    </>
  );
}
