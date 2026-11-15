"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useEffectEvent, useState } from "react";

import { SiteBranchActionDialog } from "@/components/sites/branches/site-branch-controls";
import { useSite } from "@/components/sites/site-context";
import { SitePublishDialog } from "@/components/sites/site-publish-dialog";
import {
  SiteWorkspaceContext,
  SiteWorkspaceLoadContext,
} from "@/components/sites/site-workspace-context";
import { useSiteConfigDocument } from "@/lib/hooks/use-site-config-document";
import { useSiteDrafts } from "@/lib/hooks/use-site-drafts";
import { useSiteWorkspaceState } from "@/lib/hooks/use-site-workspace-state";
import type {
  SiteWorkspaceProps,
  SiteWorkspaceReadyProps,
} from "@/types/site-workspace";
import { isInvalidSiteBranchError } from "@/utils/invalid-site-branch";

function SiteWorkspaceReady(props: SiteWorkspaceReadyProps) {
  const state = useSiteWorkspaceState(props);
  const { saves, invalid, controller } = state;
  const flush = useEffectEvent(() => {
    void saves.flush();
  });
  useEffect(() => {
    if (
      !saves.unsaved ||
      invalid ||
      state.readOnly ||
      state.discardOpen ||
      state.conflicts.length > 0 ||
      saves.state.status === "error"
    ) {
      return;
    }
    const timer = setTimeout(flush, state.publishOpen ? 0 : 800);
    return () => clearTimeout(timer);
  }, [
    saves.unsaved,
    saves.state.status,
    state.config,
    invalid,
    state.readOnly,
    state.discardOpen,
    state.conflicts.length,
    state.publishOpen,
  ]);
  return (
    <SiteWorkspaceContext value={state}>
      {props.children}
      <SiteBranchActionDialog controller={controller} />
      <SitePublishDialog
        conflicts={state.conflicts}
        rebasePending={state.rebase.isPending}
        onRebase={() => {
          if (!state.unsaved && !state.readOnly) {
            state.rebase.mutate(state.conflicts);
          }
        }}
        {...state.scope}
        branchControls={controller.props}
        open={state.publishOpen}
        onOpenChange={state.setPublishOpen}
        draftCount={props.files.drafts.length}
        drafts={props.files.drafts}
        sourcePaths={new Set(props.files.files.map((file) => file.path))}
        unsaved={state.unsaved && !state.saving}
        saving={state.saving}
        onConflict={state.setConflicts}
        onPublished={state.resetPublished}
      />
    </SiteWorkspaceContext>
  );
}

function SiteWorkspaceBranch({ children }: SiteWorkspaceProps) {
  const { organizationId, siteId, detail } = useSite();
  const [branch, setBranch] = useQueryState("branch", parseAsString);
  const document = useSiteConfigDocument();
  const production = useSiteConfigDocument(
    detail.site.productionBranch,
    Boolean(branch && branch !== detail.site.productionBranch)
  );
  const files = useSiteDrafts({
    organizationId,
    siteId,
    branch: branch ?? undefined,
  });
  // Rebases temporarily clear these queries; their local state must survive.
  const [previous, setPrevious] = useState({
    document: document.data,
    files: files.query.data,
  });
  const currentDocument = document.data ?? previous.document;
  const currentFiles = files.query.data ?? previous.files;
  if (
    currentDocument !== previous.document ||
    currentFiles !== previous.files
  ) {
    setPrevious({ document: currentDocument, files: currentFiles });
  }
  useEffect(() => {
    if (
      branch &&
      (isInvalidSiteBranchError(document.error) ||
        isInvalidSiteBranchError(files.query.error))
    ) {
      void setBranch(null);
    }
  }, [branch, document.error, files.query.error, setBranch]);
  const loadFailed = document.isError || files.query.isError;
  const load = {
    failed: loadFailed,
    retrying: document.isFetching || files.query.isFetching,
    retry: () => {
      void document.refetch();
      void files.query.refetch();
    },
  };
  return (
    <SiteWorkspaceLoadContext value={load}>
      {currentDocument && currentFiles ? (
        <SiteWorkspaceReady
          document={currentDocument}
          comparisonContent={
            production.data?.published ?? production.data?.content
          }
          files={currentFiles}
          refreshing={!document.data || !files.query.data || loadFailed}
          branch={branch ?? undefined}
          onSwitch={async (next) => {
            await setBranch(next);
          }}
          onDraftChange={files.applyDraftChange}
          onRefresh={async () => {
            const [nextDocument, nextFiles] = await Promise.all([
              document.refetch({ throwOnError: true }),
              files.query.refetch({ throwOnError: true }),
            ]);
            if (!nextDocument.data || !nextFiles.data) {
              throw new Error("Site workspace data is missing");
            }
            return { document: nextDocument.data, files: nextFiles.data };
          }}
        >
          {children}
        </SiteWorkspaceReady>
      ) : (
        children
      )}
    </SiteWorkspaceLoadContext>
  );
}

export function SiteWorkspace({ children }: SiteWorkspaceProps) {
  const { organizationId, siteId, detail } = useSite();
  const [branch] = useQueryState("branch", parseAsString);
  return (
    <SiteWorkspaceBranch
      key={JSON.stringify([
        organizationId,
        siteId,
        branch,
        detail.site.productionBranch,
        detail.site.rootDirectory,
        detail.site.repository?.owner,
        detail.site.repository?.name,
      ])}
    >
      {children}
    </SiteWorkspaceBranch>
  );
}
