import { SOURCE_BLOB_CACHE_MAX_BYTES } from "../constants/editor";
import type { SiteSourceFileContent } from "../types/editor";
import type { SiteRepository } from "../types/github";

// Blob SHAs are content addresses, so an entry never goes stale. Map order
// doubles as recency: reads re-insert, eviction drops from the front.
const blobs = new Map<string, string>();
let bytes = 0;

function key(repository: SiteRepository, sha: string) {
  return `${repository.owner}/${repository.repo}:${sha}`;
}

export function readCachedSourceBlob(
  repository: SiteRepository,
  sha: string
): SiteSourceFileContent | null {
  const id = key(repository, sha);
  const content = blobs.get(id);
  if (content === undefined) {
    return null;
  }
  blobs.delete(id);
  blobs.set(id, content);
  return { content, sha };
}

export function cacheSourceBlob(
  repository: SiteRepository,
  file: SiteSourceFileContent
) {
  const size = Buffer.byteLength(file.content);
  const id = key(repository, file.sha);
  if (size > SOURCE_BLOB_CACHE_MAX_BYTES / 8 || blobs.has(id)) {
    return;
  }
  blobs.set(id, file.content);
  bytes += size;
  for (const [oldest, content] of blobs) {
    if (bytes <= SOURCE_BLOB_CACHE_MAX_BYTES) {
      break;
    }
    blobs.delete(oldest);
    bytes -= Buffer.byteLength(content);
  }
}

/** Tests reuse one fake repository, so a cached blob would skip their read hooks. */
export function clearSourceBlobCache() {
  blobs.clear();
  bytes = 0;
}
