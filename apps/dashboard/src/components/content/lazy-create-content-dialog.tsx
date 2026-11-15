"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useState } from "react";

import { CreateContentButtonGroup } from "@/components/content/create-content-button-group";
import { GeoProjectProvider } from "@/components/providers/geo-project-provider";
import { GEO_WRITE_DIALOG_ENTRIES } from "@/constants/geo-analytics";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import type { ContentCreateEntry } from "@/types/analytics/studio-events";
import type { CreateContentActionsProps } from "@/types/content/create-post";
import dynamic from "@/utils/lazy-component";

const loadCreateContentDialog = () =>
  import("@/components/content/create-content-dialog").then(
    (mod) => mod.CreateContentDialog
  );

const loadCreatePostDialog = () =>
  import("@/components/content/create-post-dialog").then(
    (mod) => mod.CreatePostDialog
  );

const loadWriteDialog = () =>
  import("@/components/geo/writer/write-dialog").then((mod) => mod.WriteDialog);

const CreateContentDialog = dynamic(loadCreateContentDialog, { ssr: false });
const WriteDialog = dynamic(loadWriteDialog, { ssr: false });
const CreatePostDialog = dynamic(loadCreatePostDialog, { ssr: false });

export function LazyCreateContentDialog(props: CreateContentActionsProps) {
  const activeProject = useActiveProject();
  const projectId = activeProject.isResolved
    ? activeProject.projectId
    : props.initialProjectId;
  return (
    <GeoProjectProvider projectId={projectId ?? undefined}>
      <CreateContentActions {...props} />
    </GeoProjectProvider>
  );
}

function CreateContentActions({
  organizationId,
  organizationSlug,
  entry,
  articleAvailable = false,
}: CreateContentActionsProps) {
  const [open, setOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);
  const [openEntry, setOpenEntry] = useState<ContentCreateEntry>(entry);

  useHotkey(
    "C",
    () => {
      if (organizationId) {
        setOpenEntry("hotkey");
        setOpen(true);
      }
    },
    { conflictBehavior: "replace", enabled: !(open || postOpen || articleOpen) }
  );

  return (
    <>
      <CreateContentButtonGroup
        disabled={!organizationId}
        onCreateContent={() => {
          setOpenEntry(entry);
          setOpen(true);
        }}
        onCreateArticle={
          articleAvailable && entry === "content_list"
            ? () => setArticleOpen(true)
            : undefined
        }
        onCreatePost={() => setPostOpen(true)}
        onPrefetchCreateContent={() => {
          loadCreateContentDialog();
        }}
        onPrefetchCreateArticle={() => {
          loadWriteDialog();
        }}
        onPrefetchCreatePost={() => {
          loadCreatePostDialog();
        }}
      />
      {open && (
        <CreateContentDialog
          entry={openEntry}
          hideTrigger
          onOpenChange={setOpen}
          open={open}
          organizationId={organizationId}
        />
      )}
      {articleOpen && (
        <WriteDialog
          entry={GEO_WRITE_DIALOG_ENTRIES.CONTENT_LIST}
          onOpenChange={setArticleOpen}
          open={articleOpen}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
        />
      )}
      {postOpen && (
        <CreatePostDialog
          onOpenChange={setPostOpen}
          open={postOpen}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
        />
      )}
    </>
  );
}
