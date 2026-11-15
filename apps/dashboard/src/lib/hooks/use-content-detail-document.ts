"use client";

import type { GeoContentBrief } from "@notra/ai/types/geo-writer";
import { isGeoBriefMarkdown } from "@notra/geo-core/utils/geo-writer-brief-markdown";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import type { ContentResponse } from "@notra/schemas/dashboard/content";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { EditorRefHandle } from "@/components/content/editor/plugins/editor-ref-plugin";
import {
  CONTENT_AUTOSAVE_MS,
  CONTENT_SAVE_TOAST_POSITION,
  SAVE_BAR_SELECTOR,
} from "@/constants/content-detail";
import { localStorageKeys } from "@/constants/storage";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  getSaveContentDetailErrorMessage,
  checkpointContentDetail,
  saveContentDetail,
  toggleContentDetailStatus,
} from "@/lib/content/save-content-detail";
import { updateGeoWriterPlan } from "@/lib/content/update-geo-writer-plan";
import { useContentDetailTitleSlug } from "@/lib/hooks/use-content-detail-title-slug";
import {
  useGeoWriterBrief,
  useGeoWriterUpdate,
} from "@/lib/hooks/use-geo-writer";
import { useWarnBeforeUnload } from "@/lib/hooks/use-warn-before-unload";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentDocumentSaveOptions } from "@/types/content/document-save";
import type { ImageExportTarget } from "@/types/content/image-export";
import type { ContentApiResponse } from "@/types/hooks/content";
import { isContentSaveConflict } from "@/utils/content-document-save";
import { createContentIdleCheckpoint } from "@/utils/content-idle-checkpoint";
import {
  getContentArticleLoadingState,
  getGeoWriterDocumentState,
  parseGeoWriterDraft,
} from "@/utils/geo-write-entry";
import { isImageExportTarget } from "@/utils/image-export";
import { shakeElements } from "@/utils/shake-element";

interface UseContentDetailDocumentParams {
  organizationId: string;
  contentId: string;
  data: ContentApiResponse | undefined;
}

export function useContentDetailDocument({
  organizationId,
  contentId,
  data,
}: UseContentDetailDocumentParams) {
  const tToast = useTranslations("content.toasts");
  const tContentShared = useTranslations("content.shared");
  const tCommon = useTranslations("common.actions");
  const queryClient = useQueryClient();

  const geoWriterDraft = parseGeoWriterDraft(data?.content?.sourceMetadata);
  const geoWriterBriefQuery = useGeoWriterBrief(
    organizationId,
    geoWriterDraft?.briefId ?? null,
    geoWriterDraft?.projectId
  );
  const geoWriterUpdate = useGeoWriterUpdate(
    organizationId,
    contentId,
    geoWriterDraft?.projectId
  );

  const [isPlanDirty, setIsPlanDirty] = useState(false);
  const [hasPlanConflict, setHasPlanConflict] = useState(false);
  const [planEditorVersion, setPlanEditorVersion] = useState(0);
  const briefStatus = geoWriterBriefQuery.data?.status;
  const serverMarkdown = data?.content?.markdown ?? "";
  const isPostStillPlan = isGeoBriefMarkdown(serverMarkdown);
  const {
    isBriefError: isGeoWriterBriefError,
    isBriefMissing: isGeoWriterBriefMissing,
    isChatLocked: isGeoWriterChatLocked,
    isPlanMode: isGeoWriterPlanMode,
    isPlanReviewable: isGeoWriterPlanReviewableNow,
  } = getGeoWriterDocumentState(
    Boolean(geoWriterDraft),
    geoWriterBriefQuery.error,
    briefStatus,
    isPostStillPlan
  );

  const [editedMarkdown, setEditedMarkdown] = useState<string | null>(null);
  const [originalMarkdown, setOriginalMarkdown] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [imageExportTarget, setImageExportTarget] =
    useState<ImageExportTarget>("paper");
  const [writeFocusNonce, setWriteFocusNonce] = useState(0);
  const [reviewPreviousMarkdown, setReviewPreviousMarkdown] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [hasUnsyncedGitHubChanges, setHasUnsyncedGitHubChanges] =
    useState(false);
  const [hasSaveConflict, setHasSaveConflict] = useState(false);
  const saveConflictRef = useRef(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const observedContentRef = useRef(data?.content);
  const acknowledgedRevisionRef = useRef<number | null>(null);
  const autosavedRevisionRef = useRef<number | null>(null);
  const baselineRevisionRef = useRef<number | null>(
    data?.content?.revision ?? null
  );
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    if (
      baselineRevisionRef.current === null &&
      data?.content?.id === contentId
    ) {
      baselineRevisionRef.current = data.content.revision;
    }
  }, [data?.content, contentId]);
  const [loadedArticleBriefId, setLoadedArticleBriefId] = useState<
    string | null
  >(null);
  const [pendingArticleBriefId, setPendingArticleBriefId] = useState<
    string | null
  >(null);
  const geoWriterBriefId = geoWriterDraft?.briefId;
  const { shouldLoadArticle, isGeoArticleLoading } =
    getContentArticleLoadingState({
      briefId: geoWriterBriefId,
      briefStatus,
      isPostStillPlan,
      loadedArticleBriefId,
      pendingArticleBriefId,
      hasDraft: Boolean(geoWriterDraft),
    });
  if (shouldLoadArticle && geoWriterBriefId) {
    setPendingArticleBriefId(geoWriterBriefId);
  }
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const editorRef = useRef<EditorRefHandle | null>(null);
  const imageExportRef = useRef<HTMLDivElement | null>(null);
  const needsNormalizationRef = useRef(true);
  const resolvedEditedMarkdown = editedMarkdown ?? serverMarkdown;
  const resolvedOriginalMarkdown = originalMarkdown ?? serverMarkdown;
  const originalMarkdownRef = useRef(resolvedOriginalMarkdown);
  const editedMarkdownRef = useRef<string | null>(resolvedEditedMarkdown);
  const hasTrackedOpenRef = useRef<string | null>(null);

  useEffect(() => {
    const loadedContent = data?.content;
    if (!loadedContent || hasTrackedOpenRef.current === loadedContent.id) {
      return;
    }
    hasTrackedOpenRef.current = loadedContent.id;
    trackEvent(POSTHOG_EVENTS.CONTENT_OPENED, {
      content_id: contentId,
      type: loadedContent.contentType,
      status: loadedContent.status,
      from_geo_writer: Boolean(geoWriterDraft),
    });
  }, [contentId, data?.content, geoWriterDraft]);

  useEffect(() => {
    const storedTarget = window.localStorage.getItem(
      localStorageKeys.imageExportTarget
    );
    if (
      storedTarget &&
      isImageExportTarget(storedTarget) &&
      storedTarget !== "wonder"
    ) {
      setImageExportTarget(storedTarget);
    }
  }, []);

  useEffect(() => {
    originalMarkdownRef.current = resolvedOriginalMarkdown;
    editedMarkdownRef.current = resolvedEditedMarkdown;
  }, [resolvedEditedMarkdown, resolvedOriginalMarkdown]);

  useEffect(() => {
    if (
      data?.content?.contentType !== "image" ||
      editedMarkdownRef.current !== originalMarkdownRef.current ||
      (data.content.markdown ?? "") === editedMarkdownRef.current
    ) {
      return;
    }

    const nextMarkdown = data.content.markdown ?? "";
    setEditedMarkdown(nextMarkdown);
    setOriginalMarkdown(nextMarkdown);
    originalMarkdownRef.current = nextMarkdown;
    editedMarkdownRef.current = nextMarkdown;
    setEditorKey((k) => k + 1);
  }, [data?.content]);

  const currentMarkdown = resolvedEditedMarkdown;
  const {
    editingSlug,
    editingTitle,
    hasSlugChanges,
    hasTitleChanges,
    serverSlug,
    serverTitle,
    setEditingSlug: setEditingSlugState,
    setEditingTitle: setEditingTitleState,
    setPersistedSlug,
    setPersistedTitle,
    title,
  } = useContentDetailTitleSlug({
    contentTitle: data?.content?.title,
    contentSlug: data?.content?.slug,
    currentMarkdown,
  });

  const setEditingTitle = useCallback(
    (nextTitle: string | null) => {
      setSaveFailed(false);
      setEditingTitleState(nextTitle);
    },
    [setEditingTitleState]
  );
  const setEditingSlug = useCallback(
    (nextSlug: string | null) => {
      setSaveFailed(false);
      setEditingSlugState(nextSlug);
    },
    [setEditingSlugState]
  );
  const setEditedMarkdownAndRetry = useCallback(
    (markdown: string | null) => {
      setSaveFailed(false);
      setEditedMarkdown(markdown);
      editedMarkdownRef.current = markdown ?? serverMarkdown;
    },
    [serverMarkdown]
  );

  const hasMarkdownChanges =
    resolvedEditedMarkdown !== resolvedOriginalMarkdown;
  const hasDocumentChanges =
    hasMarkdownChanges || hasTitleChanges || hasSlugChanges;
  const hasChanges = hasDocumentChanges || hasUnsyncedGitHubChanges;

  useLayoutEffect(() => {
    const previous = observedContentRef.current;
    const next = data?.content;
    observedContentRef.current = next;
    if (
      !previous ||
      !next ||
      previous.id !== next.id ||
      previous.revision === next.revision ||
      acknowledgedRevisionRef.current === next.revision
    ) {
      return;
    }
    if (
      baselineRevisionRef.current === previous.revision &&
      next.markdown === previous.markdown &&
      next.title === previous.title &&
      next.slug === previous.slug &&
      next.contentType === previous.contentType
    ) {
      baselineRevisionRef.current = next.revision;
      return;
    }
    const draftDirty =
      (editedMarkdown !== null &&
        editedMarkdown !== (originalMarkdown ?? previous.markdown ?? "")) ||
      hasTitleChanges ||
      hasSlugChanges ||
      hasUnsyncedGitHubChanges;
    if (draftDirty || savingRef.current) {
      needsNormalizationRef.current = false;
      saveConflictRef.current = true;
      setHasSaveConflict(true);
      setSaveFailed(true);
      setOriginalMarkdown(originalMarkdown ?? previous.markdown ?? "");
      setEditedMarkdown((current) => current ?? previous.markdown ?? "");
      setEditingTitleState((current) => current ?? previous.title);
      setEditingSlugState((current) => current ?? previous.slug ?? "");
      return;
    }
    setOriginalMarkdown(null);
    setEditedMarkdown(null);
    baselineRevisionRef.current = next.revision;
    setPersistedTitle(null);
    setPersistedSlug(null);
    needsNormalizationRef.current = true;
    setEditorKey((key) => key + 1);
  }, [
    data?.content,
    editedMarkdown,
    originalMarkdown,
    hasTitleChanges,
    hasSlugChanges,
    hasUnsyncedGitHubChanges,
    setEditingTitleState,
    setEditingSlugState,
    setPersistedTitle,
    setPersistedSlug,
  ]);

  const applyFetchedDocument = useCallback(
    (content: ContentResponse) => {
      setHasUnsyncedGitHubChanges(false);
      const markdown = content.markdown ?? "";
      needsNormalizationRef.current = true;
      setEditedMarkdown(markdown);
      setOriginalMarkdown(markdown);
      originalMarkdownRef.current = markdown;
      editedMarkdownRef.current = markdown;
      observedContentRef.current = content;
      acknowledgedRevisionRef.current = content.revision;
      baselineRevisionRef.current = content.revision;
      setPersistedTitle(content.title);
      setPersistedSlug(content.slug);
      setEditingTitleState(null);
      setEditingSlugState(null);
      setReviewPreviousMarkdown(null);
      saveConflictRef.current = false;
      setHasSaveConflict(false);
      setSaveFailed(false);
      setEditorKey((key) => key + 1);
    },
    [
      setEditingSlugState,
      setEditingTitleState,
      setPersistedSlug,
      setPersistedTitle,
    ]
  );

  const historyRestoreApplied = useCallback(
    (content: ContentResponse) => {
      if (
        content.id !== contentId ||
        savingRef.current ||
        hasChanges ||
        editedMarkdownRef.current !== originalMarkdownRef.current
      ) {
        return false;
      }
      applyFetchedDocument(content);
      return true;
    },
    [contentId, hasChanges, applyFetchedDocument]
  );

  const refreshSaveConflict = useCallback(async () => {
    const latest = await dashboardOrpc.content.get.call({
      organizationId,
      contentId,
    });
    if (!mountedRef.current) {
      return null;
    }
    const queryKey = dashboardOrpc.content.get.queryKey({
      input: { organizationId, contentId },
    });
    queryClient.setQueryData<ContentApiResponse>(queryKey, (current) =>
      (current?.content.revision ?? 0) > latest.content.revision
        ? current
        : latest
    );
    return queryClient.getQueryData<ContentApiResponse>(queryKey) ?? latest;
  }, [organizationId, contentId, queryClient]);

  const idleCheckpoint = useMemo(
    () =>
      createContentIdleCheckpoint({
        checkpoint: async (revision) => {
          if (
            savingRef.current ||
            saveConflictRef.current ||
            editedMarkdownRef.current !== originalMarkdownRef.current ||
            !mountedRef.current
          ) {
            return false;
          }
          const cached = queryClient.getQueryData<ContentApiResponse>(
            dashboardOrpc.content.get.queryKey({
              input: { organizationId, contentId },
            })
          );
          if ((cached?.content.revision ?? 0) !== revision) {
            return false;
          }
          return (
            (await checkpointContentDetail({
              organizationId,
              contentId,
              queryClient,
            })) !== null
          );
        },
        onError: (error) => {
          if (mountedRef.current && isContentSaveConflict(error)) {
            void refreshSaveConflict().catch(() => null);
          }
        },
      }),
    [organizationId, contentId, queryClient, refreshSaveConflict]
  );

  useEffect(() => () => idleCheckpoint.cancel(), [idleCheckpoint]);

  const resolveSaveConflictLoadLatest = useCallback(async () => {
    if (savingRef.current) {
      return false;
    }
    try {
      const latest = await refreshSaveConflict();
      if (!latest) {
        return false;
      }
      applyFetchedDocument(latest.content);
      return true;
    } catch (error) {
      toast.error(
        getSaveContentDetailErrorMessage(error, tToast("saveContentFailed"))
      );
      return false;
    }
  }, [refreshSaveConflict, applyFetchedDocument, tToast]);

  const handlePlanBriefChange = useCallback(
    (nextBrief: GeoContentBrief) => {
      const briefId = geoWriterDraft?.briefId;
      const expectedUpdatedAt = geoWriterBriefQuery.data?.updatedAt;
      if (!(briefId && expectedUpdatedAt)) {
        return;
      }
      updateGeoWriterPlan({
        briefId,
        expectedUpdatedAt,
        nextBrief,
        organizationId,
        contentId,
        queryClient,
        geoWriterUpdate,
        onSuccess: (markdown) => {
          setEditedMarkdown(markdown);
          setOriginalMarkdown(markdown);
          originalMarkdownRef.current = markdown;
          editedMarkdownRef.current = markdown;
        },
        onConflict: () => {
          setHasPlanConflict(true);
        },
      });
    },
    [
      contentId,
      geoWriterDraft?.briefId,
      geoWriterBriefQuery.data?.updatedAt,
      geoWriterUpdate,
      organizationId,
      queryClient,
    ]
  );

  const handleGeoArticleReady = useCallback(
    async function refreshGeoArticle() {
      if (pendingArticleBriefId !== geoWriterDraft?.briefId) {
        return;
      }
      try {
        const [article] = await Promise.all([
          queryClient.fetchQuery({
            ...dashboardOrpc.content.get.queryOptions({
              input: { organizationId, contentId },
            }),
            staleTime: 0,
          }),
          queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.list.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.recents.key(),
          }),
        ]);
        setEditedMarkdown(null);
        setOriginalMarkdown(null);
        editedMarkdownRef.current = article.content.markdown ?? "";
        originalMarkdownRef.current = article.content.markdown ?? "";
        setPersistedSlug(null);
        setEditingTitleState(null);
        setEditingSlugState(null);
        setReviewPreviousMarkdown(null);
        needsNormalizationRef.current = true;
        setEditorKey((key) => key + 1);
      } catch {
        toast.error(tToast("refreshArticleFailed"), {
          action: {
            label: tCommon("retry"),
            onClick: () => {
              refreshGeoArticle();
            },
          },
        });
      }
      setLoadedArticleBriefId(geoWriterDraft?.briefId ?? null);
    },
    [
      contentId,
      geoWriterDraft?.briefId,
      pendingArticleBriefId,
      organizationId,
      queryClient,
      setEditingSlugState,
      setEditingTitleState,
      setPersistedSlug,
      tToast,
      tCommon,
    ]
  );

  useWarnBeforeUnload(
    hasChanges,
    useCallback(() => shakeElements(SAVE_BAR_SELECTOR), [])
  );

  const linkedGitHubPublish =
    data?.content.contentType === "changelog" ||
    data?.content.contentType === "blog_post"
      ? data.content.githubPublish
      : null;

  const handleSave = useCallback(
    async (options?: ContentDocumentSaveOptions) => {
      const resolveConflict = options?.resolveConflict === true;
      if (saveConflictRef.current && !resolveConflict) {
        return false;
      }

      const silent = options?.silent === true;
      const markdownToSave = resolvedEditedMarkdown;
      const titleToSave = title;
      const slugToSave = resolveConflict
        ? (editingSlug ?? serverSlug ?? "")
        : editingSlug;

      if (savingRef.current) {
        return false;
      }
      savingRef.current = true;
      setIsSaving(true);
      try {
        if (!hasChanges && !resolveConflict) {
          if (!silent) {
            const checkpoint = await checkpointContentDetail({
              organizationId,
              contentId,
              queryClient,
              manual: true,
            });
            if (mountedRef.current && checkpoint) {
              idleCheckpoint.markCaptured(checkpoint.revision);
            }
          }
          return true;
        }
        const latest = resolveConflict ? await refreshSaveConflict() : null;
        if (resolveConflict && !latest) {
          return false;
        }
        const contentKey = dashboardOrpc.content.get.queryKey({
          input: { organizationId, contentId },
        });
        const baseRevision = baselineRevisionRef.current ?? 0;
        const baseContent =
          queryClient.getQueryData<ContentApiResponse>(contentKey)?.content;
        const save = (base: ContentResponse | null) =>
          saveContentDetail({
            organizationId,
            contentId,
            queryClient,
            expectedRevision: base ? base.revision : baseRevision,
            hasTitleChanges: base
              ? titleToSave !== base.title
              : hasTitleChanges,
            hasSlugChanges: base
              ? slugToSave !== (base.slug ?? "")
              : hasSlugChanges,
            title: titleToSave,
            editingSlug: slugToSave,
            editedMarkdown:
              hasMarkdownChanges || resolveConflict || hasUnsyncedGitHubChanges
                ? markdownToSave
                : null,
            autosave: silent,
            onPersisted: (document) => {
              if (mountedRef.current) {
                acknowledgedRevisionRef.current = document.revision;
                baselineRevisionRef.current = document.revision;
                if (silent) {
                  autosavedRevisionRef.current = document.revision;
                }
              }
            },
          });
        let saved: Awaited<ReturnType<typeof saveContentDetail>>;
        try {
          saved = await save(latest?.content ?? null);
        } catch (error) {
          // A metadata-only write (tags, excerpt, authors) bumps the revision
          // too; it does not conflict with the draft, so retry on top of it.
          const rebased =
            !latest &&
            isContentSaveConflict(error) &&
            baseContent?.revision === baseRevision
              ? await refreshSaveConflict()
              : null;
          if (
            !rebased ||
            rebased.content.markdown !== baseContent?.markdown ||
            rebased.content.title !== baseContent.title ||
            rebased.content.slug !== baseContent.slug
          ) {
            throw error;
          }
          acknowledgedRevisionRef.current = rebased.content.revision;
          baselineRevisionRef.current = rebased.content.revision;
          saved = await save(rebased.content);
        }
        const { persistedTitle, persistedSlug, revision, cacheApplied } = saved;

        if (!mountedRef.current) {
          return false;
        }
        if (!cacheApplied) {
          saveConflictRef.current = true;
          setHasSaveConflict(true);
          setSaveFailed(true);
          return false;
        }
        if (resolveConflict) {
          saveConflictRef.current = false;
          setHasSaveConflict(false);
        } else if (saveConflictRef.current) {
          return false;
        }

        // The discard baseline is the database save, independent of GitHub sync.
        setOriginalMarkdown(markdownToSave);
        originalMarkdownRef.current = markdownToSave;
        setEditedMarkdown((current) => current ?? markdownToSave);
        if (
          reviewPreviousMarkdown &&
          !silent &&
          editedMarkdownRef.current === markdownToSave
        ) {
          setEditorKey((key) => key + 1);
          setReviewPreviousMarkdown(null);
        }
        setPersistedTitle(persistedTitle);
        setEditingTitleState((current) =>
          current === null || current === titleToSave ? null : current
        );
        setPersistedSlug(persistedSlug);
        setEditingSlugState((current) =>
          current === null || current === slugToSave ? null : current
        );
        setSaveFailed(false);

        if (
          linkedGitHubPublish &&
          (data?.content?.contentType === "changelog" ||
            data?.content?.contentType === "blog_post")
        ) {
          setHasUnsyncedGitHubChanges(true);
          if (options?.syncGitHub === false) {
            return true;
          }
          try {
            const result =
              await dashboardOrpc.content.publishChangelogToGitHub.call({
                organizationId,
                contentId,
                contentType: data.content.contentType,
                repositoryId: linkedGitHubPublish.repositoryId,
                linkedOnly: true,
              });
            if (result.skipped) {
              // The linked PR was closed or merged; keep the edits marked as not on GitHub.
              return true;
            }
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
                      owner: linkedGitHubPublish.owner,
                      path: result.path,
                      pullRequestNumber: result.pullRequestNumber,
                      pullRequestUrl: result.pullRequestUrl,
                      repo: linkedGitHubPublish.repo,
                      repositoryId: linkedGitHubPublish.repositoryId,
                    },
                  },
                };
              }
            );
            if (!mountedRef.current) {
              return false;
            }
            const latest = queryClient.getQueryData<ContentApiResponse>(
              dashboardOrpc.content.get.queryKey({
                input: { organizationId, contentId },
              })
            );
            if (
              saveConflictRef.current ||
              (latest?.content.revision ?? 0) > revision
            ) {
              saveConflictRef.current = true;
              setHasSaveConflict(true);
              setSaveFailed(true);
              return false;
            }
            setHasUnsyncedGitHubChanges(false);
            toast.success(tContentShared("pullRequestUpdated"), {
              position: CONTENT_SAVE_TOAST_POSITION,
            });
          } catch (error) {
            if (!mountedRef.current) {
              return false;
            }
            const message =
              error instanceof Error && error.message
                ? error.message
                : tToast("updatePullRequestFailed");
            toast.error(message, {
              position: CONTENT_SAVE_TOAST_POSITION,
            });
            if (mountedRef.current) {
              setSaveFailed(true);
            }
            return false;
          }
        } else {
          setHasUnsyncedGitHubChanges(false);
          if (!silent) {
            toast.success(tToast("contentSaved"), {
              position: CONTENT_SAVE_TOAST_POSITION,
            });
          }
        }
        return true;
      } catch (error) {
        if (!mountedRef.current) {
          return false;
        }
        if (isContentSaveConflict(error)) {
          saveConflictRef.current = true;
          setHasSaveConflict(true);
          setEditedMarkdown(editedMarkdownRef.current ?? markdownToSave);
          needsNormalizationRef.current = false;
          setOriginalMarkdown(resolvedOriginalMarkdown);
          setEditingTitleState((current) => current ?? titleToSave);
          setEditingSlugState((current) => current ?? serverSlug ?? "");
          try {
            await refreshSaveConflict();
          } catch {
            setSaveFailed(true);
          }
          if (!mountedRef.current) {
            return false;
          }
        }
        toast.error(
          getSaveContentDetailErrorMessage(error, tToast("saveContentFailed")),
          {
            position: CONTENT_SAVE_TOAST_POSITION,
          }
        );
        setSaveFailed(true);
        return false;
      } finally {
        savingRef.current = false;
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [
      hasChanges,
      hasMarkdownChanges,
      hasTitleChanges,
      hasSlugChanges,
      hasUnsyncedGitHubChanges,
      editingSlug,
      title,
      resolvedEditedMarkdown,
      resolvedOriginalMarkdown,
      serverSlug,
      refreshSaveConflict,
      idleCheckpoint,
      reviewPreviousMarkdown,
      organizationId,
      contentId,
      queryClient,
      setEditingSlugState,
      setEditingTitleState,
      setPersistedSlug,
      setPersistedTitle,
      linkedGitHubPublish,
      data?.content?.contentType,
      tToast,
      tContentShared,
    ]
  );

  const resolveSaveConflictSaveMine = useCallback(
    () => handleSave({ resolveConflict: true }),
    [handleSave]
  );

  useEffect(() => {
    if (
      !hasChanges ||
      isSaving ||
      saveFailed ||
      hasSaveConflict ||
      linkedGitHubPublish ||
      reviewPreviousMarkdown
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleSave({ silent: true });
    }, CONTENT_AUTOSAVE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    editingSlug,
    handleSave,
    hasChanges,
    hasSaveConflict,
    isSaving,
    linkedGitHubPublish,
    saveFailed,
    resolvedEditedMarkdown,
    reviewPreviousMarkdown,
    title,
  ]);

  useEffect(() => {
    // Autosaves are throttled server-side, so the last one before the
    // writer goes idle is captured explicitly.
    if (
      !data?.content ||
      data.content.revision !== autosavedRevisionRef.current ||
      hasChanges ||
      isSaving ||
      saveFailed ||
      hasSaveConflict
    ) {
      return;
    }
    idleCheckpoint.schedule(data.content.revision);
    return () => idleCheckpoint.cancel();
  }, [
    data?.content,
    hasChanges,
    isSaving,
    saveFailed,
    hasSaveConflict,
    idleCheckpoint,
  ]);

  useHotkey(
    "Mod+S",
    () => {
      void handleSave();
    },
    { enabled: !isSaving && !hasSaveConflict }
  );

  const handleDiscard = useCallback(() => {
    if (savingRef.current) {
      return;
    }
    if (saveConflictRef.current) {
      void resolveSaveConflictLoadLatest();
      return;
    }
    needsNormalizationRef.current = true;
    setEditedMarkdown(resolvedOriginalMarkdown);
    setOriginalMarkdown(resolvedOriginalMarkdown);
    originalMarkdownRef.current = resolvedOriginalMarkdown;
    editedMarkdownRef.current = resolvedOriginalMarkdown;
    editorRef.current?.setMarkdown(resolvedOriginalMarkdown);
    setEditingTitleState(null);
    setEditingSlugState(null);
    setReviewPreviousMarkdown(null);
    setSaveFailed(false);
    setEditorKey((key) => key + 1);
  }, [
    resolvedOriginalMarkdown,
    resolveSaveConflictLoadLatest,
    setEditingSlugState,
    setEditingTitleState,
  ]);

  const handleToggleStatus = useCallback(async () => {
    const currentStatus = data?.content?.status;
    if (!currentStatus) {
      return;
    }
    setIsTogglingStatus(true);
    try {
      await toggleContentDetailStatus({
        organizationId,
        contentId,
        queryClient,
        currentStatus,
      });
    } catch {
      toast.error(tToast("updatePostStatusFailed"));
    }
    setIsTogglingStatus(false);
  }, [data?.content?.status, organizationId, contentId, queryClient, tToast]);

  const handleEditorChange = useCallback((markdown: string) => {
    if (
      needsNormalizationRef.current &&
      editedMarkdownRef.current === originalMarkdownRef.current
    ) {
      needsNormalizationRef.current = false;
      setOriginalMarkdown(markdown);
      originalMarkdownRef.current = markdown;
    }
    needsNormalizationRef.current = false;
    setEditedMarkdown(markdown);
    editedMarkdownRef.current = markdown;
    setSaveFailed(false);
  }, []);

  const invalidateContentQueries = useCallback(
    () =>
      Promise.all([
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
      ]),
    [contentId, organizationId, queryClient]
  );

  const handleImageExportTargetSelect = useCallback((value: string) => {
    if (!isImageExportTarget(value) || value === "wonder") {
      return;
    }
    setImageExportTarget(value);
    window.localStorage.setItem(localStorageKeys.imageExportTarget, value);
  }, []);

  const resolvePlanConflictLoadLatest = useCallback(async () => {
    const result = await geoWriterBriefQuery.refetch();
    if (result.isError) {
      toast.error(tToast("loadLatestPlanFailed"));
      return;
    }
    setPlanEditorVersion((version) => version + 1);
    setHasPlanConflict(false);
  }, [geoWriterBriefQuery, tToast]);

  const resolvePlanConflictSaveMine = useCallback(async () => {
    const result = await geoWriterBriefQuery.refetch();
    if (result.isError) {
      toast.error(tToast("refreshPlanFailed"));
      return;
    }
    setHasPlanConflict(false);
  }, [geoWriterBriefQuery, tToast]);

  return {
    baselineRevisionRef,
    briefStatus,
    currentMarkdown,
    editedMarkdown: resolvedEditedMarkdown,
    editedMarkdownRef,
    editorKey,
    editorRef,
    geoWriterBriefQuery,
    geoWriterDraft,
    geoWriterUpdate,
    handleDiscard,
    handleEditorChange,
    handleGeoArticleReady,
    handleImageExportTargetSelect,
    handlePlanBriefChange,
    handleSave,
    historyRestoreApplied,
    hasSaveConflict,
    resolveSaveConflictLoadLatest,
    resolveSaveConflictSaveMine,
    handleToggleStatus,
    setEditorKey,
    hasChanges,
    hasDocumentChanges,
    hasMarkdownChanges,
    hasPlanConflict,
    hasSlugChanges,
    hasTitleChanges,
    imageExportRef,
    imageExportTarget,
    invalidateContentQueries,
    isGeoWriterBriefError,
    isGeoWriterBriefMissing,
    isGeoWriterChatLocked,
    isGeoWriterPlanMode,
    isGeoWriterPlanReviewableNow,
    isPlanDirty,
    isTogglingStatus,
    isSaving,
    saveFailed,
    isGeoArticleLoading,
    originalMarkdown: resolvedOriginalMarkdown,
    originalMarkdownRef,
    planEditorVersion,
    resolvePlanConflictLoadLatest,
    resolvePlanConflictSaveMine,
    reviewPreviousMarkdown,
    setEditedMarkdown: setEditedMarkdownAndRetry,
    setEditingSlug,
    setEditingTitle,
    setIsPlanDirty,
    setOriginalMarkdown,
    setReviewPreviousMarkdown,
    setWriteFocusNonce,
    editingSlug,
    editingTitle,
    serverSlug,
    serverTitle,
    title,
    writeFocusNonce,
  };
}

export type ContentDetailDocument = ReturnType<typeof useContentDetailDocument>;
