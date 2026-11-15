export const MAX_DRAFT_BYTES = 512 * 1024;
export const SITE_EDITOR_READ_CONCURRENCY = 8;
/** Per-instance memory for published source files, keyed by blob SHA. */
export const SOURCE_BLOB_CACHE_MAX_BYTES = 32 * 1024 * 1024;
/**
 * Validation fetches and parses source files in the dashboard process, and
 * nested Markdown parses super-linearly, so it gets a fixed budget.
 */
export const SITE_VALIDATE_MAX_FILES = 2000;
export const SITE_VALIDATE_MAX_FILE_BYTES = 1024 * 1024;
export const SITE_VALIDATE_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const EDITABLE_TEXT_FILE = /\.(?:mdx?|jsx?|json|css)$/i;
export const EDITABLE_PATH_SEGMENT = /^[A-Za-z0-9._@()+ -]+$/;
export const VALIDATED_SOURCE_FILE = /\.(?:mdx?|jsx?)$/i;
export const VALIDATED_MARKDOWN_FILE = /\.mdx?$/i;
export const MAX_PUBLISH_HEADLINE_LENGTH = 200;
/** Files whose before/after text is sent to the commit headline model. */
export const MAX_GENERATED_HEADLINE_FILES = 4;
/** One budget for reading the previous files and asking the model. */
export const GENERATED_HEADLINE_DEADLINE_MS = 6000;
/** Markdown plus images for one post; matches the GitHub publish asset budget. */
export const MAX_POST_PREVIEW_BYTES = 12 * 1024 * 1024;
/** GitHub's createCommitOnBranch rejects payloads around 20 MB. */
export const MAX_PUBLISH_BYTES = 12 * 1024 * 1024;
// createCommitOnBranch rejects a stale expectedHeadOid with "Expected branch to
// point to "<oid>" but it did not". Anything else is a real failure.
export const STALE_HEAD_ERROR_PATTERN = /expected branch to point to/i;
