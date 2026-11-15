"use client";

import type { TextSelection } from "@notra/ai/types/chat";
import { type ReactNode, useRef } from "react";

import { ContentDetailMainDocument } from "@/components/content/content-detail-main-document";
import { ContentDetailToolbar } from "@/components/content/content-detail-toolbar";
import { ContentDocumentTabs } from "@/components/content/content-document-tabs";
import { ContentPlanReadView } from "@/components/content/content-plan-read-view";
import { ContentCommentComposer } from "@/components/content/inline-comments/content-comment-composer";
import { ContentCommentsGutter } from "@/components/content/inline-comments/content-comments-gutter";
import { ContentCommentsLayer } from "@/components/content/inline-comments/content-comments-layer";
import { ContentCommentsProvider } from "@/components/content/inline-comments/content-comments-provider";
import { ContentDetachedComments } from "@/components/content/inline-comments/content-detached-comments";
import { RecommendationsSection } from "@/components/content/recommendations-section";
import { HeaderActionsPortal } from "@/components/dashboard/header-actions-portal";
import { WriterExecute } from "@/components/geo/writer/writer-execute";
import type { ContentDetailDocument } from "@/lib/hooks/use-content-detail-document";
import { useContentDocumentTab } from "@/lib/hooks/use-content-document-tab";
import type { ContentApiResponse } from "@/types/hooks/content";

interface ContentDetailLoadedViewProps {
  contentId: string;
  organizationId: string;
  organizationSlug: string;
  data: ContentApiResponse;
  document: ContentDetailDocument;
  onSelectionChange: (selection: TextSelection | null) => void;
  selectedExcerpt: TextSelection | null;
  chatInputSection: ReactNode;
}

export function ContentDetailLoadedView({
  contentId,
  organizationId,
  organizationSlug,
  data,
  document,
  onSelectionChange,
  selectedExcerpt,
  chatInputSection,
}: ContentDetailLoadedViewProps) {
  const content = data.content;
  const isLongForm = ["blog_post", "changelog"].includes(content.contentType);
  const editorViewport = useRef<HTMLDivElement>(null);
  const { outline, tab, setTab, visibleOutline } =
    useContentDocumentTab(document);

  return (
    <ContentCommentsProvider
      key={`${organizationId}:${contentId}`}
      organizationId={organizationId}
      contentId={contentId}
      document={document}
      enabled={isLongForm}
    >
      <WriterExecute.Root
        briefId={document.geoWriterDraft?.briefId ?? null}
        hasUnsavedChanges={
          document.isGeoWriterPlanMode
            ? document.isPlanDirty || document.geoWriterUpdate.isPending
            : document.hasChanges
        }
        onArticleReady={document.handleGeoArticleReady}
        organizationId={organizationId}
        projectId={document.geoWriterDraft?.projectId}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLongForm ? (
            <HeaderActionsPortal>
              <ContentDetailToolbar
                content={content}
                contentId={contentId}
                document={document}
                organizationId={organizationId}
                organizationSlug={organizationSlug}
              />
            </HeaderActionsPortal>
          ) : (
            <div className="bg-secondary sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
              <div
                aria-hidden="true"
                className="bg-secondary pointer-events-none absolute inset-x-0 top-full h-4"
              >
                <div className="bg-background h-full rounded-t-2xl" />
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <ContentDetailToolbar
                  content={content}
                  contentId={contentId}
                  document={document}
                  organizationId={organizationId}
                  organizationSlug={organizationSlug}
                />
              </div>
            </div>
          )}
          <div
            className="@container/editor relative min-h-0 flex-1 scrollbar-thin overflow-y-auto overscroll-contain py-4 md:py-6"
            data-content-scroll-viewport
            ref={editorViewport}
          >
            <ContentCommentsGutter>
              <ContentDocumentTabs
                columnClassName={isLongForm ? "max-w-3xl" : "max-w-5xl"}
                enabled={outline !== undefined}
                onValueChange={setTab}
                value={tab}
              />
              <div
                className={`relative mx-auto w-full space-y-6 px-4 lg:px-6 ${isLongForm ? "max-w-3xl" : "max-w-5xl"}`}
                data-comment-column
              >
                {document.geoWriterDraft ? <WriterExecute.Banner /> : null}

                <ContentPlanReadView brief={visibleOutline} />
                <div
                  className="space-y-6"
                  hidden={visibleOutline !== undefined}
                >
                  {isLongForm ? (
                    <ContentCommentsLayer container={editorViewport} />
                  ) : null}
                  <ContentDetailMainDocument
                    contentId={contentId}
                    data={data}
                    document={document}
                    onSelectionChange={onSelectionChange}
                    organizationId={organizationId}
                    selectedExcerpt={selectedExcerpt}
                  />
                  <ContentDetachedComments />
                </div>

                {document.isGeoWriterPlanMode || isLongForm ? null : (
                  <RecommendationsSection value={content.recommendations} />
                )}

                <div className="h-24" />
              </div>
            </ContentCommentsGutter>
          </div>
        </div>
      </WriterExecute.Root>
      {chatInputSection}
      {isLongForm ? <ContentCommentComposer /> : null}
    </ContentCommentsProvider>
  );
}
