import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  DEFAULT_GITHUB_CONTENT_DIRECTORIES,
  DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED,
} from "@/constants/github";
import { useGitHubRepositoriesDb } from "@/lib/hooks/use-github-repositories-db";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  GitHubContentDirectoryMutationVariables,
  GitHubContentPathMutationVariables,
  GitHubContentPublishingSettingsProps,
} from "@/types/integrations/github";

export function useGitHubContentPublishing({
  contentType,
  organizationId,
  repository,
  openEditor,
  onOpenEditorChange,
}: Omit<GitHubContentPublishingSettingsProps, "disabled">) {
  const t = useTranslations("integrations.github");
  const queryClient = useQueryClient();
  const repositoriesDb = useGitHubRepositoriesDb(organizationId);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const repositoryId = repository.id;
  const editing =
    openEditor?.repositoryId === repositoryId &&
    openEditor.contentType === contentType;
  const contentOutput = repository.outputs?.find(
    (output) => output.outputType === contentType
  );
  const publishingEnabled =
    contentOutput?.enabled ??
    DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED[contentType];
  const directoryQuery = useQuery(
    dashboardOrpc.integrations.repositories.contentDirectory.get.queryOptions({
      input: {
        organizationId,
        repositoryId,
        contentType,
      },
      enabled: Boolean(organizationId && repositoryId),
      staleTime: 5 * 60 * 1000,
    })
  );
  const directory =
    directoryQuery.data?.directory ??
    DEFAULT_GITHUB_CONTENT_DIRECTORIES[contentType];
  const contentPath = directoryQuery.data?.contentPath ?? null;
  const imagePath = directoryQuery.data?.imagePath ?? null;
  const loadFailed = directoryQuery.isError && !directoryQuery.data;
  const directoryQueryKey =
    dashboardOrpc.integrations.repositories.contentDirectory.get.queryKey({
      input: { organizationId, repositoryId, contentType },
    });
  const pathFieldsKey = `${repositoryId}:${contentPath ?? ""}:${imagePath ?? ""}`;
  const hasDraft = draftKey === pathFieldsKey;
  // Both saves return the whole configuration. Overlapping requests can
  // resolve out of order, so the server state is refetched after each save
  // instead of trusting the response as the latest configuration.
  const settleDirectoryConfig = (
    result: NonNullable<typeof directoryQuery.data>
  ) => {
    queryClient.setQueryData(directoryQueryKey, result);
    return queryClient.invalidateQueries({ queryKey: directoryQueryKey });
  };
  const directoryMutation = useMutation({
    mutationFn: ({
      nextDirectory,
      targetRepositoryId,
    }: GitHubContentDirectoryMutationVariables) =>
      dashboardOrpc.integrations.repositories.contentDirectory.update.call({
        organizationId,
        repositoryId: targetRepositoryId,
        contentType,
        directory: nextDirectory,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: directoryQueryKey });
    },
    onSuccess: async (result) => {
      await settleDirectoryConfig(result);
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.integrations.list.queryKey({
          input: { organizationId },
        }),
      });
    },
    onError: (error) => {
      toast.error(
        error.message || t("publishing.saveFolderFailed", { type: contentType })
      );
    },
  });
  const pathMutation = useMutation({
    mutationFn: ({
      contentPath,
      imagePath,
      targetRepositoryId,
    }: GitHubContentPathMutationVariables) =>
      dashboardOrpc.integrations.repositories.contentDirectory.update.call({
        organizationId,
        repositoryId: targetRepositoryId,
        contentType,
        contentPath,
        imagePath,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: directoryQueryKey });
    },
    onSuccess: async (result) => {
      await settleDirectoryConfig(result);
    },
    onError: (error) => {
      toast.error(
        error.message || t("publishing.savePathsFailed", { type: contentType })
      );
    },
  });
  const location =
    contentPath ??
    (directory ? `${directory}/` : t("directoryPicker.repositoryRoot"));

  const closeEditor = () => {
    onOpenEditorChange((current) =>
      current?.repositoryId === repositoryId &&
      current.contentType === contentType
        ? null
        : current
    );
  };

  const toggleEditor = () => {
    if (editing) {
      closeEditor();
      return;
    }
    onOpenEditorChange({ repositoryId, contentType });
  };

  const setPublishingEnabled = (enabled: boolean) => {
    void repositoriesDb
      .setRepositoryOutputEnabled(repositoryId, contentType, enabled)
      .catch(() => {});
  };

  const saveDirectory = async (nextDirectory: string) => {
    await directoryMutation.mutateAsync({
      nextDirectory,
      targetRepositoryId: repositoryId,
    });
  };

  const changeDraft = (dirty: boolean) => {
    setDraftKey(dirty ? pathFieldsKey : null);
  };

  const savePaths = (
    paths: Omit<GitHubContentPathMutationVariables, "targetRepositoryId">
  ) => {
    pathMutation.mutate(
      { ...paths, targetRepositoryId: repositoryId },
      {
        onSuccess: () => {
          setDraftKey(null);
          closeEditor();
        },
      }
    );
  };

  return {
    changeDraft,
    closeEditor,
    contentPath,
    directory,
    directoryQuery,
    editing,
    imagePath,
    isSavingDirectory: directoryMutation.isPending,
    isSavingPaths: pathMutation.isPending,
    loadFailed,
    location,
    pathFieldsKey,
    publishingEnabled,
    saveDirectory,
    savePaths,
    setPublishingEnabled,
    showUnsavedChanges: hasDraft && !editing,
    toggleEditor,
  };
}
