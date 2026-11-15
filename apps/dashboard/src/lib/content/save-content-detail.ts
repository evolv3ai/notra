import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  CheckpointContentDetailParams,
  SaveContentDetailParams,
} from "@/types/content/document-save";
import type { ContentApiResponse } from "@/types/hooks/content";
import { mergeSavedContentDetail } from "@/utils/content-document-save";

export async function saveContentDetail({
  organizationId,
  contentId,
  queryClient,
  expectedRevision,
  hasTitleChanges,
  hasSlugChanges,
  title,
  editingSlug,
  editedMarkdown,
  autosave = false,
  onPersisted,
}: SaveContentDetailParams) {
  const queryKey = dashboardOrpc.content.get.queryKey({
    input: { organizationId, contentId },
  });
  const cached = queryClient.getQueryData<ContentApiResponse>(queryKey);
  const responseData = await dashboardOrpc.content.saveDocument.call({
    organizationId,
    contentId,
    expectedRevision,
    autosave,
    ...(hasTitleChanges ? { title: title.trim() } : {}),
    ...(hasSlugChanges ? { slug: editingSlug?.trim() || null } : {}),
    ...(editedMarkdown !== null ? { markdown: editedMarkdown } : {}),
  });
  onPersisted?.(responseData.document);
  await queryClient.cancelQueries({ queryKey, exact: true }, { revert: false });
  queryClient.setQueryData<ContentApiResponse>(queryKey, (current) =>
    mergeSavedContentDetail(current, responseData.document)
  );
  const metadataChanged =
    cached?.content.title !== responseData.document.title ||
    cached?.content.slug !== responseData.document.slug;

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.list.key({ input: { organizationId } }),
      refetchType: metadataChanged ? "active" : "none",
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.recents.key({
        input: { organizationId },
      }),
      refetchType: metadataChanged ? "active" : "none",
    }),
    ...(cached?.content.contentType === "blog_post" ||
    cached?.content.contentType === "changelog"
      ? [
          queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.history.list.key({
              input: { organizationId, contentId },
            }),
            refetchType: "none",
          }),
        ]
      : []),
    ...(metadataChanged
      ? [
          queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.collections.list.key({
              input: { organizationId },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: dashboardOrpc.contentCalendar.list.key({
              input: { organizationId },
            }),
          }),
        ]
      : []),
  ]);

  return {
    persistedTitle: responseData.document.title,
    persistedSlug: responseData.document.slug,
    revision: responseData.document.revision,
    cacheApplied:
      (queryClient.getQueryData<ContentApiResponse>(queryKey)?.content
        .revision ?? 0) === responseData.document.revision,
  };
}

export async function checkpointContentDetail({
  organizationId,
  contentId,
  queryClient,
  manual = false,
}: CheckpointContentDetailParams) {
  const cached = queryClient.getQueryData<ContentApiResponse>(
    dashboardOrpc.content.get.queryKey({
      input: { organizationId, contentId },
    })
  );
  if (
    cached?.content.contentType !== "blog_post" &&
    cached?.content.contentType !== "changelog"
  ) {
    return null;
  }
  const checkpoint = await dashboardOrpc.content.history.checkpoint.call({
    organizationId,
    contentId,
    expectedRevision: cached.content.revision,
    manual,
  });
  await queryClient.invalidateQueries({
    queryKey: dashboardOrpc.content.history.list.key({
      input: { organizationId, contentId },
    }),
    refetchType: "none",
  });
  return checkpoint;
}

export function getSaveContentDetailErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

interface ToggleContentDetailStatusParams {
  organizationId: string;
  contentId: string;
  queryClient: QueryClient;
  currentStatus: string;
}

export async function toggleContentDetailStatus({
  organizationId,
  contentId,
  queryClient,
  currentStatus,
}: ToggleContentDetailStatusParams) {
  const newStatus = currentStatus === "published" ? "draft" : "published";

  await dashboardOrpc.content.update.call({
    organizationId,
    contentId,
    status: newStatus,
  });

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.get.queryKey({
        input: { organizationId, contentId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.list.key(),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.recents.key(),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.collections.list.key(),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.metrics.get.queryKey({
        input: { organizationId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.contentCalendar.list.key(),
    }),
  ]);

  toast.success(
    newStatus === "published" ? "Post published" : "Post moved to drafts"
  );
}
