import type { SitePreviewPointer } from "@notra/sites-core/types/deployment";

import type { PostPreviewSource } from "../types/sites";

/** A post preview with a password is protected; without one, the link is enough. */
export function postPreviewPointerAccess(
  access: PostPreviewSource["access"]
): Pick<SitePreviewPointer, "visibility" | "expiresAt" | "access"> {
  return {
    visibility: access.password ? "protected" : "public",
    expiresAt: access.expiresAt,
    access: { password: access.password },
  };
}
