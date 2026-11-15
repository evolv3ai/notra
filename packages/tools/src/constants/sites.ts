export const PUBLIC_SITE_COLUMNS = {
  id: true,
  projectId: true,
  name: true,
  publicOrigin: true,
  mounts: true,
} as const;

export const SITE_CONTENT_TIMEOUT_MS = 10_000;
export const SITE_CONTENT_MAX_BYTES = 32 * 1024;
export const SITE_CONTENT_TYPES = new Set(["text/markdown", "text/plain"]);
