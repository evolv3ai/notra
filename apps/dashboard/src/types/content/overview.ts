import type { posts } from "@notra/db/schema";
import type { ContentResponse } from "@notra/schemas/dashboard/content";
import type {
  ContentAuthor,
  PostMetadataPatch,
} from "@notra/schemas/shared/post-metadata";
import type { ReactNode } from "react";

import type {
  CONTENT_AUTHOR_LINK_FIELDS,
  CONTENT_PANEL_TABS,
} from "@/constants/content-overview";
export type ContentPanelTab = (typeof CONTENT_PANEL_TABS)[number]["id"];

export type CoverSource = "upload" | "link" | "post";

export interface ContentOverviewProps {
  organizationId: string;
  contentId: string;
  content: ContentResponse;
  children?: ReactNode;
}

export interface UseContentMetadataParams {
  organizationId: string;
  contentId: string;
  content: ContentResponse;
}

export interface ContentMetadataApi {
  metadata: ContentResponse["metadata"];
  /** Saves right away and updates the cached post optimistically. */
  update: (patch: PostMetadataPatch) => void;
  /** Same as `update`, but waits until typing pauses. */
  updateDebounced: (patch: PostMetadataPatch) => void;
  /** Sends a debounced edit now and resolves once every write has landed. */
  flushPending: () => Promise<void>;
}

export interface ContentPanelOverviewProps {
  onClose: () => void;
  children: ReactNode;
}

export interface OverviewFieldProps {
  label: string;
  hint: ReactNode;
  htmlFor?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export interface OverviewToggleRowProps {
  label: string;
  hint: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export interface OverviewCreatedByRowProps {
  sourceMetadata: unknown;
}

export interface OverviewDisclosureProps {
  label: string;
  children: ReactNode;
}

export interface OverviewCoverFieldProps {
  api: ContentMetadataApi;
  markdown: string;
}

export interface OverviewTagsInputProps {
  organizationId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export interface OverviewAuthorSelectProps {
  organizationId: string;
  authorIds: string[];
  onChange: (authorIds: string[]) => void;
}

export interface ContentAuthorAvatarProps {
  author: Pick<ContentAuthor, "name" | "avatarUrl">;
  className?: string;
}

export interface ContentAuthorsDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ContentAuthorFormProps {
  organizationId: string;
  author: ContentAuthor | null;
  onDone: () => void;
}

/** Author form state: every text field as a string, empty when unset. */
export type ContentAuthorDraft = {
  name: string;
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string | null;
} & Record<(typeof CONTENT_AUTHOR_LINK_FIELDS)[number], string>;

/** The post columns that make up its site metadata. */
export type PostMetadataColumns = Pick<
  typeof posts.$inferSelect,
  | "coverImage"
  | "tags"
  | "excerpt"
  | "authorIds"
  | "featured"
  | "noindex"
  | "hidden"
  | "displayDate"
>;

export interface ContentStatusBadgeProps {
  status: ContentResponse["status"];
}

export interface OverviewDateFieldProps {
  id: string;
  /** Date chosen in Notra, YYYY-MM-DD, or null to use the publish date. */
  value: string | null;
  /** The publish date shown while no date is chosen, YYYY-MM-DD. */
  fallback: string;
  onChange: (value: string | null) => void;
}

export interface OverviewHintProps {
  /** Field the hint explains, for the button's accessible name. */
  field: string;
  children: ReactNode;
}

export interface ContentMetadataTarget {
  organizationId: string;
  contentId: string;
}

export interface PendingMetadataPatch {
  target: ContentMetadataTarget;
  patch: PostMetadataPatch;
}
