import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import type { SiteImageUploadKind } from "@notra/sites-core/types/uploads";
import { useBlocker } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useSite } from "@/components/sites/site-context";
import { useRebaseSiteDrafts } from "@/lib/hooks/use-rebase-site-drafts";
import { useSiteBranchControls } from "@/lib/hooks/use-site-branch-controls";
import { useSiteDraftSaves } from "@/lib/hooks/use-site-draft-saves";
import { useSiteWorkingBranch } from "@/lib/hooks/use-site-working-branch";
import { useWarnBeforeUnload } from "@/lib/hooks/use-warn-before-unload";
import { readFileAsDataUrl } from "@/lib/onboarding/logo-file";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteRawConfig } from "@/types/site-design";
import type { SiteVariableRow } from "@/types/site-variables";
import type { SiteWorkspaceReadyProps } from "@/types/site-workspace";
import { serializeSiteConfig } from "@/utils/site-design";
import {
  parseDesignSource,
  designIssues,
  repairSiteConfig,
  validDesignSource,
} from "@/utils/site-design-sections";
import { siteDraftVersion } from "@/utils/site-draft-version";
import { validateVariableRows } from "@/utils/site-variables";

export function useSiteWorkspaceState({
  document,
  comparisonContent,
  files,
  refreshing = false,
  branch,
  onSwitch,
  onDraftChange,
  onRefresh,
}: SiteWorkspaceReadyProps) {
  const { organizationId, organizationSlug, siteId, detail } = useSite();
  const scope = { organizationId, siteId, branch };
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [recovering, setRecovering] = useState(false);
  // After a publish the cached document still points at the deleted draft.
  const [settling, setSettling] = useState(false);
  const uploads = useRef(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const uploading = pendingUploads > 0;
  const saves = useSiteDraftSaves(scope, onDraftChange, setConflicts);
  const [buffer, setBuffer] = useState<SiteRawConfig | null>(null);
  const [snapshot, setSnapshot] = useState(document);
  const [variableRows, setVariableRows] = useState<SiteVariableRow[]>(() =>
    Object.entries(parseDesignSource(document.content).variables ?? {}).map(
      ([name, value]) => ({ id: name, name, value: String(value) })
    )
  );
  const [variableError, setVariableError] = useState<
    "invalid" | "duplicate" | null
  >(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const malformed = !validDesignSource(document.content);
  const config = buffer ?? parseDesignSource(document.content);
  const issues = designIssues(config);
  const brokenSource =
    buffer === null && variableError === null && issues.length > 0;
  const invalid =
    (issues.length > 0 && !brokenSource) || variableError !== null;
  const unsaved = saves.unsaved || invalid || uploading;
  /** Edits autosave will still push; Publish flushes them instead of waiting. */
  const saving =
    saves.unsaved && !invalid && !uploading && saves.state.status !== "error";
  const drafts = files.drafts;
  const draftVersion = siteDraftVersion(drafts);
  const branchState = useSiteWorkingBranch({
    ...scope,
    productionBranch: detail.site.productionBranch,
    filesError: null,
    draftVersion,
    draftCount: drafts.length,
    paused: recovering || discardOpen || uploading,
    saves: { ...saves, unsaved },
    onFlushed: () => {
      if (saves.resetClean([SITE_CONFIG_FILENAME]).length > 0) {
        setBuffer(null);
      }
    },
    onConflict: setConflicts,
    onSwitch,
  });
  useWarnBeforeUnload(unsaved || recovering);
  useBlocker({
    disabled: !unsaved && !recovering,
    enableBeforeUnload: false,
    shouldBlockFn: async ({ next }) => {
      const sitePath = `/${organizationSlug}/sites/${siteId}`;
      const search = next.search as { branch?: unknown; project?: unknown };
      if (
        !uploading &&
        (next.pathname === sitePath ||
          next.pathname.startsWith(`${sitePath}/`)) &&
        (search.branch == null ? undefined : String(search.branch)) ===
          branch &&
        (search.project == null ||
          String(search.project) === detail.site.projectId)
      ) {
        return false;
      }
      if (invalid || uploading || conflicts.length > 0 || readOnly) {
        return true;
      }
      return saves.flush().then(
        () => false,
        () => true
      );
    },
  });
  const assertSavable = () => {
    if (invalid || uploading || conflicts.length > 0 || (readOnly && unsaved)) {
      throw new Error("Invalid site configuration");
    }
  };
  const controller = useSiteBranchControls({
    ...scope,
    productionBranch: detail.site.productionBranch,
    draftCount: drafts.length,
    draftVersion,
    unsaved,
    saveState: saves.state,
    commitStatus: branchState.commitStatus,
    onSwitch: branchState.switchBranch,
    onFlush: async () => {
      assertSavable();
      if (!readOnly) {
        await branchState.flush();
      }
    },
    onSave: async () => {
      assertSavable();
      if (!readOnly) {
        await saves.flush();
      }
    },
    onPublish: () => setPublishOpen(true),
  });
  const rebase = useRebaseSiteDrafts({
    ...scope,
    onRebased: () => setConflicts([]),
    onSettled: (paths) => {
      if (saves.resetClean(paths).includes(SITE_CONFIG_FILENAME)) {
        setBuffer(null);
      }
    },
  });
  const readOnly = refreshing || rebase.isPending || recovering || settling;
  if (snapshot !== document && !unsaved) {
    setSnapshot(document);
    setBuffer(null);
    setVariableRows(
      Object.entries(parseDesignSource(document.content).variables ?? {}).map(
        ([name, value]) => ({ id: name, name, value: String(value) })
      )
    );
    saves.resetClean([SITE_CONFIG_FILENAME]);
  }
  const update = (next: SiteRawConfig) => {
    if (malformed || readOnly) {
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(config)) {
      return;
    }
    setBuffer(next);
    if (designIssues(next).length > 0) {
      return;
    }
    saves.getQueue(SITE_CONFIG_FILENAME).edit({
      ...scope,
      path: SITE_CONFIG_FILENAME,
      content: serializeSiteConfig(next),
      baseBlobSha: snapshot.blobSha,
      baseCommitSha: files.commitSha,
      draftId: snapshot.draftId,
      draftRevision: snapshot.draftRevision,
      sourceContext: snapshot.sourceContext,
    });
  };
  /** Saves the image as a draft in public/images and returns its site path. */
  const uploadImage = async (
    file: File,
    kind: SiteImageUploadKind
  ): Promise<string> => {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await dashboardOrpc.sites.editor.uploadImage.call({
      ...scope,
      fileName: file.name,
      kind,
      data: dataUrl.slice(dataUrl.indexOf(",") + 1),
      baseCommitSha: files.commitSha,
      sourceContext: snapshot.sourceContext,
    });
    if (result.draft) {
      onDraftChange(
        result.draft.path,
        new Date(result.draft.updatedAt),
        result.draft
      );
    }
    return result.path;
  };
  const updateVariables = (rows: SiteVariableRow[]) => {
    if (readOnly) {
      return;
    }
    setVariableRows(rows);
    const filled = rows.filter((row) => row.name.trim() || row.value);
    const result = validateVariableRows(filled);
    setVariableError(result.error);
    if (!result.error) {
      update({ ...config, variables: result.variables });
    }
  };
  const repair = () => {
    const next = repairSiteConfig(config, detail.site.name);
    if (!next) {
      return;
    }
    setVariableRows(
      Object.entries(next.variables ?? {}).map(([name, value]) => ({
        id: name,
        name,
        value: String(value),
      }))
    );
    setVariableError(null);
    update(next);
  };
  const resolveConflict = async (keep: boolean) => {
    if (readOnly || saves.state.status === "saving" || (keep && invalid)) {
      return;
    }
    setRecovering(true);
    try {
      let latest = await onRefresh();
      if (keep) {
        await rebase.mutateAsync(conflicts);
        latest = await onRefresh();
      }
      saves.reset();
      setSnapshot(latest.document);
      if (keep) {
        saves.getQueue(SITE_CONFIG_FILENAME).edit({
          ...scope,
          path: SITE_CONFIG_FILENAME,
          content: serializeSiteConfig(config),
          baseBlobSha: latest.document.blobSha,
          baseCommitSha: latest.files.commitSha,
          draftId: latest.document.draftId,
          draftRevision: latest.document.draftRevision,
          sourceContext: latest.document.sourceContext,
        });
        await saves.flush();
      } else {
        setBuffer(null);
        setVariableError(null);
        setVariableRows(
          Object.entries(
            parseDesignSource(latest.document.content).variables ?? {}
          ).map(([name, value]) => ({ id: name, name, value: String(value) }))
        );
      }
      setConflicts([]);
    } catch {
      setConflicts([SITE_CONFIG_FILENAME]);
    }
    setRecovering(false);
  };
  const discardChanges = async () => {
    if (
      readOnly ||
      uploads.current > 0 ||
      branchState.commitStatus === "pending"
    ) {
      return;
    }
    setRecovering(true);
    try {
      const paths = new Set(drafts.map((draft) => draft.path));
      if (buffer !== null || variableError !== null || saves.unsaved) {
        paths.add(SITE_CONFIG_FILENAME);
      }
      const attemptedPaths = [...paths];
      const results = await Promise.allSettled(
        attemptedPaths.map((path) => {
          const draft = drafts.find((entry) => entry.path === path);
          return saves.getQueue(path).discard({
            draftId: draft?.id ?? null,
            draftRevision: draft?.revision ?? null,
            sourceContext: files.sourceContext,
          });
        })
      );
      const discarded = new Set(
        attemptedPaths.filter(
          (_, index) => results[index]?.status === "fulfilled"
        )
      );
      if (
        !paths.has(SITE_CONFIG_FILENAME) ||
        discarded.has(SITE_CONFIG_FILENAME)
      ) {
        saves.reset();
      } else {
        saves.resetClean([...discarded]);
      }
      if (discarded.has(SITE_CONFIG_FILENAME)) {
        setSnapshot({
          ...document,
          content: document.published ?? "",
          hasDraft: false,
          draftId: null,
          draftRevision: null,
          blobSha: document.publishedBlobSha,
        });
        setBuffer(null);
        setVariableError(null);
        setVariableRows(
          Object.entries(
            parseDesignSource(document.published ?? "").variables ?? {}
          ).map(([name, value]) => ({ id: name, name, value: String(value) }))
        );
      }
      setConflicts((current) => current.filter((path) => !discarded.has(path)));
      await onRefresh();
      const failed = results.find((result) => result.status === "rejected");
      if (failed) {
        await Promise.reject(failed.reason);
      }
    } catch (error) {
      setRecovering(false);
      throw error;
    }
    setRecovering(false);
  };
  return {
    uploading,
    beginImageUpload: () => {
      uploads.current += 1;
      setPendingUploads(uploads.current);
      return () => {
        uploads.current -= 1;
        setPendingUploads(uploads.current);
      };
    },
    discardChanges,
    discardOpen,
    setDiscardOpen,
    readOnly,
    rebase,
    malformed,
    variableRows,
    variableError,
    updateVariables,
    config,
    published: parseDesignSource(
      comparisonContent ?? document.published ?? document.content
    ),
    issues,
    brokenSource,
    repair,
    update,
    saves,
    unsaved,
    saving,
    invalid,
    controller,
    publishOpen,
    setPublishOpen,
    conflicts,
    setConflicts,
    resolveConflict,
    scope,
    files,
    uploadImage,
    document,
    resetPublished: () => {
      setSettling(true);
      void onRefresh()
        .catch(() => undefined)
        .then(() => {
          saves.resetClean([SITE_CONFIG_FILENAME]);
          setBuffer(null);
          setSettling(false);
        });
    },
  };
}
