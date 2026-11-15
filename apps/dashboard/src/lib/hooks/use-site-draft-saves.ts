import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SiteDraftSaveQueue,
  SiteDraftSaveState,
  SiteDraftResult,
} from "@/types/site-drafts";
import type { SiteScope } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import { createSiteDraftSaveQueue } from "@/utils/site-draft-save-queue";
import { isSiteDraftUnsaved, publishConflictPaths } from "@/utils/site-drafts";

export function useSiteDraftSaves(
  scope: SiteScope,
  onDraftChange: (
    path: string,
    updatedAt: Date | null,
    draft: SiteDraftResult | null
  ) => void,
  onConflict?: (paths: string[]) => void
) {
  const queryClient = useQueryClient();
  const t = useTranslations("sites.drafts");
  const [states, setStates] = useState<Record<string, SiteDraftSaveState>>({});
  const queues = useRef(new Map<string, SiteDraftSaveQueue>()).current;
  const scopeKey = `${scope.organizationId}:${scope.siteId}:${scope.branch ?? ""}:`;

  const getQueue = (path: string, generation = 0) => {
    const key = `${scopeKey}${path}:${generation}`;
    const existing = queues.get(key);
    if (existing) {
      return existing;
    }
    const readOptions = dashboardOrpc.sites.editor.read.queryOptions({
      input: { ...scope, path },
    });
    const queue = createSiteDraftSaveQueue({
      save: async (input) => {
        // A read started before this save must not replace its acknowledged buffer.
        await queryClient.cancelQueries({ queryKey: readOptions.queryKey });
        try {
          return await dashboardOrpc.sites.editor.saveDraft.call(input);
        } catch (error) {
          const paths = publishConflictPaths(error);
          if (paths) {
            onConflict?.(paths.length > 0 ? paths : [path]);
          }
          throw error;
        }
      },
      discard: async (input) => {
        await dashboardOrpc.sites.editor.discardDraft.call({
          ...scope,
          path,
          ...input,
        });
      },
      onSaved: (input, result) => {
        void queryClient.cancelQueries({ queryKey: readOptions.queryKey });
        queryClient.setQueryData(readOptions.queryKey, (current) =>
          current
            ? {
                ...current,
                content: input.content,
                hasDraft: true,
                draftId: result.draftId,
                draftRevision: result.draftRevision,
              }
            : current
        );
        onDraftChange(path, new Date(result.updatedAt), result);
      },
      onDiscarded: async () => {
        queryClient.setQueryData(readOptions.queryKey, (current) =>
          current
            ? {
                ...current,
                content: current.published ?? "",
                hasDraft: false,
                draftId: null,
                draftRevision: null,
                blobSha: current.publishedBlobSha,
              }
            : current
        );
        onDraftChange(path, null, null);
        await queryClient.invalidateQueries({ queryKey: readOptions.queryKey });
      },
      onStateChange: (state) =>
        setStates((current) => ({ ...current, [key]: state })),
      errorMessage: (error) => toErrorMessage(error, t("saveFailed")),
    });
    queues.set(key, queue);
    return queue;
  };

  const activeStates = Object.entries(states)
    .filter(([key]) => key.startsWith(scopeKey))
    .map(([, state]) => state);
  return {
    getQueue,
    state: activeStates.find((state) => state.status === "error") ??
      activeStates.find(
        (state) => state.status === "saving" || state.status === "dirty"
      ) ?? { status: "idle" as const },
    flush: async () => {
      const active = [...queues.entries()]
        .filter(([key]) => key.startsWith(scopeKey))
        .map(([, queue]) => queue);
      await Promise.all(active.map((queue) => queue.flush()));
      if (
        active.some((queue) => isSiteDraftUnsaved(queue.getSnapshot().state))
      ) {
        throw new Error(t("saveFailed"));
      }
    },
    unsaved: Object.entries(states).some(
      ([key, state]) => key.startsWith(scopeKey) && isSiteDraftUnsaved(state)
    ),
    reset: () => {
      queues.clear();
      setStates({});
    },
    resetClean: (paths: readonly string[]) => {
      const removed = paths.filter((path) => {
        const entries = [...queues].filter(([key]) =>
          key.startsWith(`${scopeKey}${path}:`)
        );
        if (
          entries.length === 0 ||
          entries.some(([, queue]) =>
            isSiteDraftUnsaved(queue.getSnapshot().state)
          )
        ) {
          return false;
        }
        for (const [key] of entries) {
          queues.delete(key);
        }
        return true;
      });
      if (removed.length > 0) {
        setStates((current) => {
          const next = { ...current };
          for (const path of removed) {
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${scopeKey}${path}:`)) {
                delete next[key];
              }
            }
          }
          return next;
        });
      }
      return removed;
    },
  };
}
