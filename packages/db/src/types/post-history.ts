import type { POST_HISTORY_SOURCES } from "../constants/post-history";
import type { Database } from "./database";
import type { PostCoverImage } from "./post-metadata";

export type PostHistorySource = (typeof POST_HISTORY_SOURCES)[number];
export type PostHistoryTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export interface PostHistoryMetadata {
  contentType: string;
  contentSubtype: string | null;
  recommendations: string | null;
  coverImage: PostCoverImage | null;
  tags: string[];
  excerpt: string | null;
  authorIds: string[];
  featured: boolean;
  noindex: boolean;
  displayDate: string | null;
}

export interface PostHistoryContext {
  actorUserId: string | null;
  source: PostHistorySource;
}

export interface PostHistoryCheckpointInput extends PostHistoryContext {
  organizationId: string;
  postId: string;
  expectedRevision: number;
}

export interface PostHistoryCheckpointResult {
  id: string;
  revision: number;
}

export type PostHistoryErrorCode = "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT";

export interface PostHistoryScope {
  organizationId: string;
  postId: string;
}
