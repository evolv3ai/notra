import { SITE_BUILD_LIMITS } from "@notra/sites-core/constants/sites";

import type { RepositoryTreeScan } from "../types/github";

export const MAX_TARBALL_BYTES = SITE_BUILD_LIMITS.maxSourceBytes;
export const CHECK_RUN_NAME = "Notra Sites";
export const UNCHANGED_BUILD_TITLE = "Skipped – no site changes";
/** GitHub rejects check run summaries above 65535 characters. */
export const CHECK_RUN_SUMMARY_MAX_LENGTH = 60_000;
export const CHECK_RUN_ANNOTATION_MAX_LENGTH = 1000;
export const CHECK_RUN_UPDATE_TIMEOUT_MS = 5000;
export const CHECK_RUN_LOCK_TIMEOUT_MS = 8000;
export const CHECK_RUN_STATE_TIMEOUT_MS = 2000;
export const PREVIEW_COMMENT_TITLES = {
  live: "✅ Preview ready",
  failed: "❌ Build failed",
  skipped: "⏭️ Build skipped",
  not_live: "⏭️ Preview not published",
  held: "⏸️ Automatic publishing paused",
} as const;

export const BRANCH_SUGGESTION_LIMIT = 300;
export const GITHUB_PAGE_SIZE = 100;
/** The pull request files endpoint lists at most 3000 files. */
export const GITHUB_PULL_REQUEST_MAX_FILES = 3000;
export const CONTENT_FILE = /^(?:(.*)\/)?(blog|changelog)\/.+\.mdx?$/;

export const CONFIG_SEARCH_SKIPPED_SEGMENTS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "vendor",
]);

export const EMPTY_TREE_SCAN: RepositoryTreeScan = {
  directories: [],
  contentCounts: {},
  truncated: false,
};
export const GITHUB_ARCHIVE_TIMEOUT_MS = 60_000;
export const GITHUB_SOURCE_DOWNLOAD_CONCURRENCY = 4;
export const GITHUB_SOURCE_DOWNLOAD_MAX_FILES = 128;
export const GITHUB_TREE_RESPONSE_MAX_BYTES = 16 * 1024 * 1024;
export const GITHUB_SOURCE_METADATA_MAX_BYTES = 512 * 1024;
export const GITHUB_METADATA_ATTRIBUTE_LINE =
  /^\S+\s+[-!]?linguist-[\w-]+(?:=\S+)?(?:\s+[-!]?linguist-[\w-]+(?:=\S+)?)*$/;
export const GITHUB_LFS_POINTER_HEADER =
  "version https://git-lfs.github.com/spec/v1";
// The compare API lists at most 300 changed files for a whole comparison
// (per_page only pages its commits), so 300 files may mean a cut-off list.
export const GITHUB_COMPARE_MAX_FILES = 300;

/** Installation tokens live for an hour; reuse them for half of that. */
export const REPOSITORY_TOKEN_CACHE_MS = 30 * 60 * 1000;
export const REPOSITORY_TOKEN_CACHE_LIMIT = 500;
