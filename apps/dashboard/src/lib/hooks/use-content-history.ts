"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentHistoryProps } from "@/types/content/history";

export function useContentHistory({
  content,
  contentId,
  document,
  organizationId,
  recovery,
  onRestoreBusyChange,
  active = true,
}: ContentHistoryProps) {
  const t = useTranslations("content.history");
  const client = useQueryClient();
  const input = { organizationId, contentId };
  const [versionId, setVersionId] = useState<string | null>(null);
  const { needsRefresh, setNeedsRefresh, restoredRevision } = recovery;
  const latestDocument = useRef(document);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    latestDocument.current = document;
  }, [document]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const revision = content.revision;
  const history = useInfiniteQuery({
    enabled: active,
    queryKey: dashboardOrpc.content.history.list.infiniteKey({
      input: (cursor: number | undefined) => ({ ...input, cursor, limit: 20 }),
      initialPageParam: undefined as number | undefined,
    }),
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      dashboardOrpc.content.history.list.call({
        ...input,
        cursor: pageParam,
        limit: 20,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
  });
  const selected = useQuery({
    ...dashboardOrpc.content.history.get.queryOptions({
      input: { ...input, versionId: versionId ?? "" },
    }),
    enabled: active && versionId !== null,
  });
  const selectedRevision = selected.data?.version.revision;
  const canRestore =
    !document.hasChanges &&
    !document.isSaving &&
    selectedRevision !== undefined &&
    selectedRevision !== revision;
  const restore = useMutation({
    mutationFn: async () => {
      if (
        (!canRestore && !needsRefresh) ||
        !versionId ||
        latestDocument.current.hasChanges ||
        latestDocument.current.isSaving
      ) {
        throw new Error(t("saveFirst"));
      }
      onRestoreBusyChange(true);
      if (restoredRevision.current === null) {
        const result = await dashboardOrpc.content.history.restore.call({
          ...input,
          versionId,
          expectedRevision: revision,
        });
        restoredRevision.current = result.revision;
        setNeedsRefresh(true);
      }
      await client.cancelQueries(
        {
          queryKey: dashboardOrpc.content.get.queryKey({ input }),
          exact: true,
        },
        { revert: false }
      );
      const detail = await client.fetchQuery({
        ...dashboardOrpc.content.get.queryOptions({ input }),
        staleTime: 0,
      });
      if (!mounted.current) {
        return;
      }
      if (
        detail.content.id !== contentId ||
        restoredRevision.current === null ||
        detail.content.revision < restoredRevision.current
      ) {
        throw new Error(t("refreshFailed"));
      }
      if (
        latestDocument.current.hasChanges ||
        latestDocument.current.isSaving
      ) {
        throw new Error(t("draftPreserved"));
      }
      if (!latestDocument.current.historyRestoreApplied(detail.content)) {
        throw new Error(t("draftPreserved"));
      }
      restoredRevision.current = null;
      setNeedsRefresh(false);
      await Promise.all([
        client.invalidateQueries({
          queryKey: dashboardOrpc.content.history.list.key(),
        }),
        client.invalidateQueries({
          queryKey: dashboardOrpc.content.list.key(),
          refetchType: "inactive",
        }),
        client.invalidateQueries({
          queryKey: dashboardOrpc.content.recents.key(),
          refetchType: "inactive",
        }),
        client.invalidateQueries({
          queryKey: dashboardOrpc.content.collections.list.key(),
          refetchType: "inactive",
        }),
      ]);
    },
    onSettled: () => onRestoreBusyChange(false),
  });
  return {
    history,
    selected,
    versionId,
    setVersionId,
    restore,
    needsRefresh,
    canRestore: canRestore && !needsRefresh && !restore.isPending,
    canRefresh:
      needsRefresh &&
      !document.hasChanges &&
      !document.isSaving &&
      !restore.isPending,
  };
}
