import type { siteDrafts } from "@notra/db/schema";

export type SiteDraft = typeof siteDrafts.$inferSelect;
export type SiteDraftSummary = Omit<SiteDraft, "content">;

export interface SiteSourceEntry {
  path: string;
  sha: string;
  size: number;
}

export interface SiteValidationDraftBudget {
  count: number;
  bytes: number;
}

export interface SiteSourceListing {
  commitSha: string;
  files: SiteSourceEntry[];
}

export interface SiteSourceFileContent {
  content: string;
  sha: string;
}

export interface RepositoryFileRef {
  path: string;
  ref: string;
}

/** A published file as a draft compares against it; binaries only read their SHA. */
export interface SitePublishedFile {
  sha: string;
  content: string | null;
}

export interface SiteDraftCodec {
  /** Whether comparing needs the published content or only its blob SHA. */
  published: "content" | "sha";
  assertValid(path: string, content: string): void;
  /** Whether the published file already holds this content. */
  matches(content: string, file: SitePublishedFile): boolean;
  /** Base64 for GitHub's createCommitOnBranch. */
  toCommit(content: string): string;
  toValidator(content: string): string | null;
  byteSize(content: string): number;
}

export interface RepositoryBranchInput {
  name: string;
  sha: string;
}

export interface CreateCommitOnBranchResponse {
  createCommitOnBranch: { commit: { oid: string } };
}

export interface SaveSiteDraftInput {
  branch?: string;
  path: string;
  content: string;
  baseBlobSha: string | null;
  baseCommitSha: string | null;
  deleted?: boolean;
  userId: string;
  draftId: string | null;
  draftRevision: number | null;
  sourceContext: SiteEditorSourceContext;
}

export interface SaveSiteImageDraftInput {
  branch?: string;
  fileName: string;
  bytes: Uint8Array;
  baseCommitSha: string | null;
  userId: string;
  sourceContext: SiteEditorSourceContext;
}

export interface SiteEditorSourceContext {
  repositoryId: string;
  productionBranch: string;
  rootDirectory: string;
}

export interface SiteDraftMutationInput {
  branch?: string;
  path: string;
  draftId: string | null;
  draftRevision: number | null;
  sourceContext: SiteEditorSourceContext;
}

export interface PublishSiteDraftsInput {
  skipIfBusy?: boolean;
  /** Generated from the pending drafts when omitted. */
  message?: string;
  branch?: string;
  userId: string;
}

export interface PublishSiteDraftsResult {
  commitSha: string;
  pullRequestUrl: string | null;
}

export interface RepositoryCommitInput {
  branch: string;
  headline: string;
  expectedHeadOid: string;
  /** `contents` is base64, as createCommitOnBranch expects. */
  additions: Array<{ path: string; contents: string }>;
  deletions: string[];
}

export interface RepositoryPullRequestInput {
  title: string;
  head: string;
  base: string;
  body: string;
  draft?: boolean;
}
