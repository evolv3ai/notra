"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@notra/ui/components/ui/alert-dialog";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentCollaboration } from "@/components/content/content-collaboration";
import { ContentDeleteDialog } from "@/components/content/content-delete-dialog";
import { ContentGitStatus } from "@/components/content/content-git-status";
import { PublishContentToGitHubDialog } from "@/components/content/publish-content-to-github-dialog";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { useRouter } from "@/lib/navigation";
import type { ContentDetailToolbarProps } from "@/types/components/content-detail-toolbar";

export function ContentDetailDocumentActions(props: ContentDetailToolbarProps) {
  const { content, contentId, document, organizationId, organizationSlug } =
    props;
  const t = useTranslations("content.toolbar");
  const tActions = useTranslations("common.actions");
  const tCollaboration = useTranslations("content.collaboration");
  const tHeader = useTranslations("content.header");
  const tGitHub = useTranslations("content.githubPublish");
  const router = useRouter();
  const { deletePost, isDeleting } = usePostActions(organizationId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const githubPublish = content.githubPublish;
  const blocked =
    document.hasSaveConflict ||
    document.isSaving ||
    document.isGeoArticleLoading;
  if (document.hasSaveConflict && (githubOpen || discardOpen)) {
    setGithubOpen(false);
    setDiscardOpen(false);
  }

  return (
    <section aria-label={tHeader("moreActions")} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-w-0"
          onClick={() => setHistoryOpen(true)}
          size="sm"
          variant="outline"
        >
          {tCollaboration("history")}
        </Button>

        <Button
          className="min-w-0"
          disabled={blocked || !document.currentMarkdown.trim()}
          onClick={() => setGithubOpen(true)}
          size="sm"
          variant="outline"
        >
          <Github aria-hidden="true" />
          <span className="min-w-0 truncate">
            {githubPublish ? tActions("update") : tGitHub("trigger")}
          </span>
        </Button>
      </div>
      {githubPublish ? (
        <ContentGitStatus
          contentId={contentId}
          organizationId={organizationId}
          githubPublish={githubPublish}
        />
      ) : null}
      {document.hasDocumentChanges && !document.hasSaveConflict ? (
        <Button
          className="w-full justify-start"
          disabled={document.isSaving}
          onClick={() => setDiscardOpen(true)}
          size="sm"
          variant="ghost"
        >
          {t("discardChanges")}
        </Button>
      ) : null}
      <Button
        className="w-full justify-start"
        variant="ghost"
        size="sm"
        disabled={blocked}
        onClick={() => setDeleteOpen(true)}
      >
        {tActions("delete")}
      </Button>
      <ContentDeleteDialog
        contentId={contentId}
        organizationId={organizationId}
        title={content.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        pending={isDeleting}
        onConfirm={async (remove) => {
          if (await deletePost(contentId, remove)) {
            router.push(`/${organizationSlug}/content`);
          }
        }}
      />
      <ContentCollaboration
        {...props}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      {content.contentType === "blog_post" ||
      content.contentType === "changelog" ? (
        <PublishContentToGitHubDialog
          contentId={contentId}
          contentType={content.contentType}
          githubPublish={githubPublish}
          onSave={() => document.handleSave({ syncGitHub: false })}
          onPublished={document.resolveSaveConflictLoadLatest}
          open={githubOpen}
          onOpenChange={setGithubOpen}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          title={document.title}
        />
      ) : null}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discardChanges")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tHeader("discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tActions("cancel")}</AlertDialogCancel>
            <Button
              disabled={document.isSaving}
              variant="destructive"
              onClick={() => {
                document.handleDiscard();
                setDiscardOpen(false);
              }}
            >
              {t("discardChanges")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
