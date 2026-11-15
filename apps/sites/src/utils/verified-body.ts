import { SITE_BUILD_LIMITS } from "@notra/sites-core/constants/sites";
import type { SiteManifestFile } from "@notra/sites-core/types/deployment";
import { sha256Hex } from "@notra/sites-core/utils/hash";

/**
 * Reads a file body and returns it only if it matches the manifest's size and
 * hash, so a content-addressed cache entry can never hold other bytes.
 * Buffering is bounded by the manifest size (at most the per-file build limit).
 */
export async function readVerifiedBody(
  body: ReadableStream<Uint8Array>,
  file: SiteManifestFile
): Promise<Uint8Array<ArrayBuffer> | null> {
  // Cancelling one tee branch waits for the other (unread on HEAD), so it is
  // never awaited.
  if (file.size > SITE_BUILD_LIMITS.maxSingleFileBytes) {
    body.cancel().catch(() => undefined);
    return null;
  }
  const bytes = new Uint8Array(file.size);
  const reader = body.getReader();
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (offset + value.byteLength > bytes.byteLength) {
      reader.cancel().catch(() => undefined);
      return null;
    }
    bytes.set(value, offset);
    offset += value.byteLength;
  }
  if (offset !== bytes.byteLength) {
    return null;
  }
  return (await sha256Hex(bytes)) === file.sha256 ? bytes : null;
}
