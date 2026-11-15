"use client";

import type { SocialVideoAttachment } from "@notra/schemas/types/dashboard/content";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ContentApiResponse } from "@/types/hooks/content";

import { dashboardOrpc } from "../orpc/query";

export function useContent(organizationId: string, contentId: string) {
  return useQuery<ContentApiResponse>(
    dashboardOrpc.content.get.queryOptions({
      input: { organizationId, contentId },
      enabled: !!organizationId && !!contentId,
    })
  );
}

/** Saves the video posted with an X/LinkedIn post, so the calendar sends it too. */
export function useSaveSocialVideo(organizationId: string, contentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: dashboardOrpc.content.get.queryKey({
      input: { organizationId, contentId },
    }),
    mutationFn: (socialVideo: SocialVideoAttachment | null) =>
      dashboardOrpc.content.update.call({
        organizationId,
        contentId,
        socialVideo,
      }),
    onSuccess: (_result, socialVideo) => {
      const queryKey = dashboardOrpc.content.get.queryKey({
        input: { organizationId, contentId },
      });
      queryClient.setQueryData<ContentApiResponse>(queryKey, (current) =>
        current
          ? {
              ...current,
              content: {
                ...current.content,
                sourceMetadata: {
                  ...current.content.sourceMetadata,
                  socialVideo,
                },
              },
            }
          : current
      );
      return queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useIsSavingSocialVideo(
  organizationId: string,
  contentId: string
) {
  return (
    useIsMutating({
      mutationKey: dashboardOrpc.content.get.queryKey({
        input: { organizationId, contentId },
      }),
      exact: true,
    }) > 0
  );
}
