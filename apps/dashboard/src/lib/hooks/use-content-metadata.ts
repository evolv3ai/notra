"use client";

import type { ContentResponse } from "@notra/schemas/dashboard/content";
import type { PostMetadataPatch } from "@notra/schemas/shared/post-metadata";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { CONTENT_METADATA_DEBOUNCE_MS } from "@/constants/content-overview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ContentMetadataApi,
  ContentMetadataTarget,
  PendingMetadataPatch,
  UseContentMetadataParams,
} from "@/types/content/overview";
import type { ContentApiResponse } from "@/types/hooks/content";
import {
  applyMetadataPatch,
  mergeContentMetadataSave,
} from "@/utils/content-metadata";
import { toErrorMessage } from "@/utils/error-message";

export function useContentMetadata(
  params: UseContentMetadataParams
): ContentMetadataApi {
  const { organizationId, contentId } = params;
  const t = useTranslations("content.overview");
  const queryClient = useQueryClient();

  const setMetadataFor = useCallback(
    (
      target: ContentMetadataTarget,
      update: (
        metadata: ContentResponse["metadata"]
      ) => ContentResponse["metadata"]
    ) => {
      queryClient.setQueryData<ContentApiResponse>(
        dashboardOrpc.content.get.queryKey({ input: target }),
        (current) =>
          current
            ? {
                ...current,
                content: {
                  ...current.content,
                  metadata: update(current.content.metadata),
                },
              }
            : current
      );
    },
    [queryClient]
  );

  const pending = useRef<PendingMetadataPatch | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequest = useRef(0);
  const queue = useRef<Promise<void> | null>(null);

  const write = useCallback(
    (target: ContentMetadataTarget, patch: PostMetadataPatch) => {
      const request = ++latestRequest.current;
      const run = async () => {
        try {
          const result = await dashboardOrpc.content.updateMetadata.call({
            ...target,
            metadata: patch,
          });
          if (result.githubSyncError) {
            toast.error(result.githubSyncError);
          }
          const queryKey = dashboardOrpc.content.get.queryKey({
            input: target,
          });
          await queryClient.cancelQueries(
            { queryKey, exact: true },
            { revert: false }
          );
          queryClient.setQueryData<ContentApiResponse>(queryKey, (current) =>
            mergeContentMetadataSave(
              current,
              result.content,
              request !== latestRequest.current || pending.current !== null
            )
          );
          void queryClient.invalidateQueries({ queryKey });
          void queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.pullRequestState.queryKey({
              input: target,
            }),
          });
        } catch (error) {
          toast.error(toErrorMessage(error, t("saveFailed")));
          void queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.get.queryKey({ input: target }),
          });
        }
      };
      queue.current = (queue.current ?? Promise.resolve()).then(run);
      return queue.current;
    },
    [queryClient, t]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    return next
      ? write(next.target, next.patch)
      : (queue.current ?? Promise.resolve());
  }, [write]);

  const updateDebounced = useCallback(
    (patch: PostMetadataPatch) => {
      const target = { organizationId, contentId };
      setMetadataFor(target, (metadata) => applyMetadataPatch(metadata, patch));
      if (pending.current && pending.current.target.contentId !== contentId) {
        void flush();
      }
      pending.current = {
        target,
        patch: { ...pending.current?.patch, ...patch },
      };
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        void flush();
      }, CONTENT_METADATA_DEBOUNCE_MS);
    },
    [contentId, flush, organizationId, setMetadataFor]
  );

  const flushNow = useEffectEvent(() => {
    void flush();
  });
  useEffect(() => () => flushNow(), [organizationId, contentId]);

  return {
    metadata: params.content.metadata,
    update: updateDebounced,
    updateDebounced,
    flushPending: flush,
  };
}
