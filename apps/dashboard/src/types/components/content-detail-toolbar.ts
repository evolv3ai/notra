import type { ContentResponse } from "@notra/schemas/dashboard/content";

import type { ContentDetailDocument } from "@/lib/hooks/use-content-detail-document";
import type { usePostSitePreview } from "@/lib/hooks/use-post-site-preview";

export interface ContentDetailToolbarProps {
  content: ContentResponse;
  contentId: string;
  document: ContentDetailDocument;
  organizationId: string;
  organizationSlug: string;
}

export interface ContentDetailPublishActionsProps extends ContentDetailToolbarProps {
  videoPending: boolean;
}

export type ContentDetailStatusButtonProps = Pick<
  ContentDetailToolbarProps,
  "content" | "document"
> & { hasUnsavedChanges: boolean };

export type ContentDetailImageActionsProps = Pick<
  ContentDetailToolbarProps,
  "content" | "contentId" | "document" | "organizationId"
>;

export type ContentSitePreviewProps = Pick<
  ContentDetailToolbarProps,
  "contentId" | "document" | "organizationId"
>;

type PostSitePreviewModel = ReturnType<typeof usePostSitePreview>;

export interface PostSitePreviewSectionProps {
  model: PostSitePreviewModel;
}

export interface PostSitePreviewActionsProps extends PostSitePreviewSectionProps {
  document: ContentDetailToolbarProps["document"];
}
