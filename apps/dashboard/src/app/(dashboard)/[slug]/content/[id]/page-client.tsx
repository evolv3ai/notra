"use client";

import { supportsPostSlug } from "@notra/ai/schemas/post";

import { ChatQuoteProvider } from "@/components/chat/chat-quote";
import {
  ContentDetailChatPanel,
  ContentDetailFloatingChat,
} from "@/components/content/content-detail-chat-shell";
import { ContentDetailDocumentActions } from "@/components/content/content-detail-document-actions";
import { ContentDetailLoadedView } from "@/components/content/content-detail-loaded-view";
import { ContentDetailNotFound } from "@/components/content/content-detail-not-found";
import {
  ContentSitePreviewPanel,
  ContentSitePreviewPrefetch,
} from "@/components/content/content-site-preview-panel";
import { ContentOverview } from "@/components/content/overview/content-overview";
import { GeoProjectProvider } from "@/components/providers/geo-project-provider";
import { useContentDetailChat } from "@/lib/hooks/use-content-detail-chat";
import { useContentDetailDocument } from "@/lib/hooks/use-content-detail-document";
import type { ContentDetailPageClientProps } from "@/types/content/detail";
import { parseGeoWriterDraft } from "@/utils/geo-write-entry";

import { useContent } from "../../../../../lib/hooks/use-content";
import { ContentDetailSkeleton } from "./skeleton";

export default function PageClient(props: ContentDetailPageClientProps) {
  const { data } = useContent(props.organizationId, props.contentId);
  const draft = parseGeoWriterDraft(data?.content.sourceMetadata);

  return (
    <GeoProjectProvider projectId={draft?.projectId}>
      <ContentDetailPage {...props} />
    </GeoProjectProvider>
  );
}

function ContentDetailPage({
  contentId,
  organizationSlug,
  organizationId,
}: ContentDetailPageClientProps) {
  const { data, isPending } = useContent(organizationId, contentId);
  const document = useContentDetailDocument({
    organizationId,
    contentId,
    data,
  });
  const chat = useContentDetailChat({
    organizationId,
    organizationSlug,
    contentId,
    content: data?.content,
    contentDocument: document,
  });

  const floatingChat = (
    <ContentDetailFloatingChat {...chat.floatingChatProps} />
  );

  if (isPending) {
    return (
      <>
        <ContentDetailSkeleton />
        {floatingChat}
      </>
    );
  }

  if (!data?.content) {
    return (
      <>
        <ContentDetailNotFound organizationSlug={organizationSlug} />
        {floatingChat}
      </>
    );
  }

  return (
    <ContentDetailLoadedView
      chatInputSection={
        <ChatQuoteProvider conversationId={chat.chatPanelProps.activeChatId}>
          {floatingChat}
          {supportsPostSlug(data.content.contentType) ? (
            <ContentSitePreviewPrefetch
              contentId={contentId}
              organizationId={organizationId}
            />
          ) : null}
          <ContentDetailChatPanel
            {...chat.chatPanelProps}
            overview={
              supportsPostSlug(data.content.contentType) ? (
                <ContentOverview
                  content={data.content}
                  contentId={contentId}
                  organizationId={organizationId}
                >
                  <ContentDetailDocumentActions
                    content={data.content}
                    contentId={contentId}
                    document={document}
                    organizationId={organizationId}
                    organizationSlug={organizationSlug}
                  />
                </ContentOverview>
              ) : undefined
            }
            preview={
              supportsPostSlug(data.content.contentType) ? (
                <ContentSitePreviewPanel
                  contentId={contentId}
                  document={document}
                  organizationId={organizationId}
                />
              ) : undefined
            }
          />
        </ChatQuoteProvider>
      }
      contentId={contentId}
      data={data}
      document={document}
      onSelectionChange={chat.handleSelectionChange}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      selectedExcerpt={chat.selection}
    />
  );
}
