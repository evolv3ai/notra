import type { ChatAttachment } from "@notra/ai/types/chat";

import { CHAT_CONTENT_KEY_RE } from "@/constants/attachments";
import type { ChatUploadCandidate } from "@/types/upload/client";
import { sha256File } from "@/utils/sha256-file";

const HEIC_FILE_RE = /\.heic$/i;

export function attachedContentHashes(
  attachments: readonly ChatAttachment[],
  pendingHashes: Iterable<string>
): Set<string> {
  const hashes = new Set(pendingHashes);
  for (const attachment of attachments) {
    const hash = CHAT_CONTENT_KEY_RE.exec(attachment.key)?.[1];
    if (hash) {
      hashes.add(hash);
    }
  }
  return hashes;
}

/**
 * Hashes files one at a time, so only one file is buffered, and drops files
 * already attached or repeated in the batch before any slot is spent on them.
 * HEIC files are hashed after conversion, inside the upload.
 */
export async function splitDuplicateChatFiles(
  files: readonly File[],
  knownHashes: ReadonlySet<string>
): Promise<{ unique: ChatUploadCandidate[]; duplicates: File[] }> {
  const seen = new Set(knownHashes);
  const unique: ChatUploadCandidate[] = [];
  const duplicates: File[] = [];
  for (const file of files) {
    if (HEIC_FILE_RE.test(file.name) || file.type === "image/heic") {
      unique.push({ file });
      continue;
    }
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- sequential on purpose to bound memory
    const sha256 = await sha256File(file);
    if (seen.has(sha256)) {
      duplicates.push(file);
      continue;
    }
    seen.add(sha256);
    unique.push({ file, sha256 });
  }
  return { unique, duplicates };
}
