import type { PostMetadataColumns } from "@/types/content/overview";
import type { GitHubPublishContentType } from "@/types/integrations/github";

export interface SiteGitHubPublishTarget {
  siteId: string;
  rootDirectory: string;
  productionBranch: string;
  sectionMounted: boolean;
}

export type SiteConfigAuthorNames = Record<string, string>;

/** An author as written into a blog post's frontmatter. */
export interface SiteEntryAuthor {
  id: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  avatar?: string | null;
  url?: string | null;
  x?: string | null;
  linkedin?: string | null;
  github?: string | null;
}

/** Post metadata edited in Notra. Unset values keep what the repo file has. */
export interface SiteEntryMetadata {
  description?: string | null;
  image?: { src: string; alt: string } | null;
  tags?: string[];
  authors?: SiteEntryAuthor[];
  featured?: boolean;
  noindex?: boolean;
  hidden?: boolean;
  /** Date shown on the site, chosen in Notra. */
  date?: Date | null;
}

export interface BuildSiteEntryMarkdownParams {
  contentType: GitHubPublishContentType;
  markdown: string;
  title: string;
  /** Fallback publication date when neither Notra nor the repo file has one. */
  date: Date;
  /** Legacy single author (id or name) used when Notra has no authors set. */
  author?: string | null;
  metadata?: SiteEntryMetadata;
  /** The entry as it is in the repository today, if it exists. */
  existingMarkdown?: string | null;
  /** Set when the entry is already live and this publish changes it. */
  updated?: Date | null;
}

export interface SiteMarkdownNode {
  alt?: string | null;
  children?: SiteMarkdownNode[];
  depth?: number;
  type: string;
  url?: string;
  value?: string;
}

export interface FindSiteGitHubPublishTargetParams {
  organizationId: string;
  projectId?: string | null;
  siteId?: string | null;
  existingPublication?: { siteId?: string; baseBranch?: string; path: string };
  contentType: GitHubPublishContentType;
  repository: {
    id: string;
    githubRepositoryId: string | null;
    owner: string;
    repo: string;
  };
}

export interface ReadSiteRepositoryTextFileParams {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

export interface ResolveSiteEntryContextParams {
  token: string;
  owner: string;
  repo: string;
  contentType: GitHubPublishContentType;
  /** Where the entry would be written when there is no open pull request. */
  path: string;
  target: SiteGitHubPublishTarget;
  publisherUserId: string | undefined;
  existingEntry: { branchName: string; path: string } | undefined;
}

export interface SiteEntryContext {
  existingMarkdown: string | null;
  /** The entry already exists on the production branch. */
  isLive: boolean;
  author: string | null;
}

export interface ResolveSiteEntrySlugParams {
  contentId: string;
  slug: string | null;
  title: string;
}

/** Where cover and avatar files go in the pull request. */
export interface SiteEntryMediaContext {
  contentPath: string;
  imagePathTemplate: string;
  organizationId: string;
  publicDirectory: string;
  slug: string;
}

export interface PrepareSiteEntryFilesParams {
  post: PostMetadataColumns & {
    title: string;
    markdown: string;
    createdAt: Date;
    publishedAt: Date | null;
  };
  contentType: GitHubPublishContentType;
  contentPath: string;
  /** Configured image path; empty uses the site's public directory. */
  imagePath?: string | null;
  organizationId: string;
  rootDirectory: string;
  slug: string;
  siteEntry: SiteEntryContext | null;
}
