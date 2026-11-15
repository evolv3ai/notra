"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ContentPublishingTarget } from "@/components/content/content-publishing-target";
import { GitHubPublishDialogFooter } from "@/components/content/github-publish-dialog-footer";
import { GitHubPublishRecoveryAlert } from "@/components/content/github-publish-recovery-alert";
import { GitHubPublishRepositoryField } from "@/components/content/github-publish-repository-field";
import { GitHubPublishResultCard } from "@/components/content/github-publish-result-card";
import { useGitHubPublishRepositorySelection } from "@/lib/hooks/use-github-publish-repository-selection";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  GitHubPublishDialogBodyProps,
  PublishContentToGitHubDialogProps,
} from "@/types/content/detail";
import type { ContentApiResponse } from "@/types/hooks/content";
import { githubPublishDialogCopy } from "@/utils/github-publish-dialog-copy";
import { getGitHubPublishRecovery } from "@/utils/github-publish-recovery";
import { formatGitHubRepositoryLabel } from "@/utils/github-publish-repositories";
import {
  readStoredGitHubPublishRepositoryId,
  writeStoredGitHubPublishRepositoryId,
} from "@/utils/github-publish-repository-preference";
import { resolveGitHubPublishingSiteId } from "@/utils/github-publish-site-selection";

function GitHubPublishDialogBody({
  contentLabel,
  connectedRepositoryCount,
  integrationsLoadFailed,
  isLoadingIntegrations,
  isPublishing,
  onRepositoryChange,
  onRetryIntegrations,
  organizationSlug,
  publishRecovery,
  pullRequest,
  repositories,
  selectedPublishingEnabled,
  selectedRepository,
  title,
}: GitHubPublishDialogBodyProps) {
  const tCommon = useTranslations("common");
  if (pullRequest) {
    const repositoryLabel = selectedRepository
      ? formatGitHubRepositoryLabel(selectedRepository)
      : tCommon("labels.repository");

    return (
      <GitHubPublishResultCard
        pullRequest={pullRequest}
        repositoryLabel={repositoryLabel}
        title={title}
      />
    );
  }

  return (
    <>
      <GitHubPublishRepositoryField
        connectedRepositoryCount={connectedRepositoryCount}
        contentLabel={contentLabel}
        integrationsLoadFailed={integrationsLoadFailed}
        isLoadingIntegrations={isLoadingIntegrations}
        isPublishing={isPublishing}
        onRepositoryChange={onRepositoryChange}
        onRetryIntegrations={onRetryIntegrations}
        organizationSlug={organizationSlug}
        repositories={repositories}
        selectedPublishingEnabled={selectedPublishingEnabled}
        selectedRepository={selectedRepository}
      />
      {publishRecovery ? (
        <GitHubPublishRecoveryAlert publishRecovery={publishRecovery} />
      ) : null}
    </>
  );
}

export function PublishContentToGitHubDialog({
  contentId,
  contentType,
  githubPublish,
  onSave,
  onPublished,
  organizationId,
  organizationSlug,
  title,
  open,
  onOpenChange,
}: PublishContentToGitHubDialogProps) {
  const t = useTranslations("content.githubPublish");
  const tGit = useTranslations("content.gitPublishing");
  const [siteId, setSiteId] = useState<string | undefined>(
    githubPublish?.siteId
  );
  const tContentShared = useTranslations("content.shared");
  const queryClient = useQueryClient();
  const [repositoryId, setRepositoryId] = useState(
    () =>
      githubPublish?.repositoryId ??
      readStoredGitHubPublishRepositoryId(organizationId) ??
      ""
  );
  const {
    repositories,
    selectedRepositoryId,
    selectedRepository,
    selectedPublishingEnabled,
    fieldProps,
  } = useGitHubPublishRepositorySelection({
    organizationId,
    contentType,
    repositoryId,
    enabled: open,
  });
  const { contentLabel } = fieldProps;
  const target = useQuery(
    dashboardOrpc.integrations.repositories.contentDirectory.get.queryOptions({
      input: {
        organizationId,
        repositoryId: selectedRepositoryId,
        contentType,
        contentId,
      },
      enabled: open && Boolean(selectedRepositoryId),
    })
  );
  const selectedSiteId = resolveGitHubPublishingSiteId(siteId, target.data);
  const branch =
    target.data?.sites.find((site) => site.id === selectedSiteId)
      ?.productionBranch ??
    selectedRepository?.defaultBranch ??
    "main";

  const invalidateIntegrations = () => {
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.integrations.list.queryKey({
        input: { organizationId },
      }),
    });
  };

  const publishMutation = useMutation({
    mutationFn: async (targetRepositoryId: string) => {
      const saved = await onSave();
      if (!saved) {
        throw new Error(t("saveBeforePublishing", { kind: contentLabel }));
      }

      return dashboardOrpc.content.publishChangelogToGitHub.call({
        organizationId,
        contentId,
        contentType,
        repositoryId: targetRepositoryId,
        siteId: selectedSiteId,
      });
    },
    onSuccess: async (result, targetRepositoryId) => {
      const repository = repositories.find(
        (item) => item.id === targetRepositoryId
      );
      const linkedRepository = repository;
      invalidateIntegrations();
      if (linkedRepository) {
        queryClient.setQueryData<ContentApiResponse>(
          dashboardOrpc.content.get.queryKey({
            input: { organizationId, contentId },
          }),
          (current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              content: {
                ...current.content,
                githubPublish: {
                  branchName: result.branchName,
                  owner: linkedRepository.owner,
                  path: result.path,
                  pullRequestNumber: result.pullRequestNumber,
                  pullRequestUrl: result.pullRequestUrl,
                  repo: linkedRepository.repo,
                  repositoryId: linkedRepository.id,
                },
              },
            };
          }
        );
      }
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.content.get.queryKey({
          input: { organizationId, contentId },
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.content.pullRequestState.queryKey({
          input: { organizationId, contentId },
        }),
      });
      await onPublished?.();
      const fallbackMessage = result.fallbackReason
        ? tGit(
            result.fallbackReason === "protected"
              ? "protectedFallback"
              : result.fallbackReason === "changed"
                ? "changedFallback"
                : "draftFallback",
            { branch }
          )
        : undefined;
      toast.success(
        result.direct
          ? tGit("publishedDirectly", { branch: result.branchName })
          : result.operation === "created"
            ? t("prCreated")
            : tContentShared("pullRequestUpdated"),
        { description: fallbackMessage }
      );
    },
    onError: (error) => {
      invalidateIntegrations();
      if (getGitHubPublishRecovery(error)) {
        return;
      }
      toast.error(error.message || t("createFailed"));
    },
  });
  const pullRequest = publishMutation.data;
  const publishRecovery = getGitHubPublishRecovery(publishMutation.error);
  const copy = githubPublishDialogCopy({
    direct: pullRequest?.direct,
    operation: pullRequest?.operation,
    title: tGit("publish"),
    description:
      target.data?.reviewProcess === "direct"
        ? tGit("publishesDirectly", { branch })
        : tGit("pullRequestDescription", { branch }),
    directDescription: tGit("publishedDirectly", {
      branch: pullRequest?.branchName ?? branch,
    }),
    createdTitle: t("prCreated"),
    createdDescription: t("createdDescription", { kind: contentLabel }),
    updatedTitle: tContentShared("pullRequestUpdated"),
    updatedDescription: t("updatedDescription", { kind: contentLabel }),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (publishMutation.isPending) {
        return;
      }
      publishMutation.reset();
    }
    onOpenChange(nextOpen);
  };

  const rememberRepository = (nextRepositoryId: string) => {
    setRepositoryId(nextRepositoryId);
    writeStoredGitHubPublishRepositoryId(organizationId, nextRepositoryId);
  };

  const handleRepositoryChange = (nextRepositoryId: string) => {
    if (nextRepositoryId === selectedRepositoryId) {
      return;
    }
    setSiteId(undefined);
    rememberRepository(nextRepositoryId);
    publishMutation.reset();
  };

  const handleSubmit = () => {
    if (publishMutation.isPending) {
      return;
    }
    if (selectedRepository) {
      rememberRepository(selectedRepository.id);
      publishMutation.mutate(selectedRepository.id);
    }
  };

  return (
    <ResponsiveDialog onOpenChange={handleOpenChange} open={open}>
      <ResponsiveDialogContent className="min-w-0 sm:max-w-[600px]">
        <div className="contents">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{copy.title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {copy.description}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="min-w-0 space-y-4">
            <GitHubPublishDialogBody
              {...fieldProps}
              isPublishing={publishMutation.isPending}
              onRepositoryChange={handleRepositoryChange}
              organizationSlug={organizationSlug}
              publishRecovery={publishRecovery}
              pullRequest={pullRequest}
              title={title}
            />
            {!pullRequest && target.data ? (
              <ContentPublishingTarget
                config={target.data}
                siteId={selectedSiteId}
                onSiteChange={setSiteId}
                branch={branch}
                disabled={publishMutation.isPending}
              />
            ) : null}
          </div>

          <ResponsiveDialogFooter>
            <GitHubPublishDialogFooter
              onPublish={handleSubmit}
              hasSelectedRepository={
                Boolean(selectedRepository) &&
                !target.isLoading &&
                !(
                  target.data &&
                  target.data.sites.length > 1 &&
                  !selectedSiteId
                )
              }
              isPublishing={publishMutation.isPending}
              organizationSlug={organizationSlug}
              publishRecovery={publishRecovery}
              pullRequest={pullRequest}
              selectedPublishingEnabled={selectedPublishingEnabled}
            />
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
