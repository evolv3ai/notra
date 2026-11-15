import { SITE_IMAGE_UPLOAD_MAX_BYTES } from "@notra/sites-core/constants/uploads";
import { isSiteImageDraftPath } from "@notra/sites-core/utils/image-drafts";

import { MAX_DRAFT_BYTES } from "../constants/editor";
import { BASE64 } from "../constants/site-draft-codec";
import { SiteInputError } from "../errors/sites";
import type { SiteDraftCodec } from "../types/editor";
import { gitBlobSha, sniffSiteImageExtension } from "./image-type";

/** Decoded bytes, or null when the content isn't canonical base64. */
function base64Bytes(content: string): Buffer | null {
  if (content.length % 4 !== 0 || !BASE64.test(content)) {
    return null;
  }
  const bytes = Buffer.from(content, "base64");
  return bytes.toString("base64") === content ? bytes : null;
}

export function imageTooLargeError() {
  return new SiteInputError(
    `Images can be at most ${SITE_IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024} MB`
  );
}

/** Markdown, JSON, CSS and scripts: UTF-8 text compared by content. */
const textCodec: SiteDraftCodec = {
  published: "content",
  assertValid(_path, content) {
    if (Buffer.byteLength(content, "utf8") > MAX_DRAFT_BYTES) {
      throw new SiteInputError("This file is too large to edit in the browser");
    }
  },
  matches: (content, file) => file.content === content,
  toCommit: (content) => Buffer.from(content).toString("base64"),
  toValidator: (content) => content,
  byteSize: (content) => Buffer.byteLength(content, "utf8"),
};

/** Images under public/: base64 bytes compared by blob SHA. */
const imageCodec: SiteDraftCodec = {
  published: "sha",
  assertValid(path, content) {
    const bytes = base64Bytes(content);
    if (!bytes) {
      throw new SiteInputError("Image drafts must be base64-encoded");
    }
    if (bytes.byteLength > SITE_IMAGE_UPLOAD_MAX_BYTES) {
      throw imageTooLargeError();
    }
    const extension = sniffSiteImageExtension(bytes);
    const claimed = path.slice(path.lastIndexOf(".")).toLowerCase();
    if (
      !extension ||
      (claimed !== extension && !(claimed === ".jpeg" && extension === ".jpg"))
    ) {
      throw new SiteInputError(
        `${path} is not a valid ${claimed.slice(1)} image`
      );
    }
  },
  matches(content, file) {
    const bytes = base64Bytes(content);
    return bytes !== null && file.sha === gitBlobSha(bytes);
  },
  toCommit: (content) => content,
  // The validator only needs to know images exist, not their bytes.
  toValidator: () => null,
  byteSize: (content) => (content.length * 3) / 4,
};

/** How a draft at this path is stored, compared and committed. */
export function siteDraftCodec(path: string): SiteDraftCodec {
  return isSiteImageDraftPath(path) ? imageCodec : textCodec;
}
