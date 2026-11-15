import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import { Effect } from "effect";

import { r2DeleteKey, r2GetTextEffect, r2PutEffect } from "./r2";
import { postPreviewSourceSchema } from "./schemas/post-preview";
import type { PostPreviewSource } from "./types/sites";
import { safeJson } from "./utils/json";
import { runSitesEffect } from "./utils/run-sites-effect";
import { withSiteStorageLock } from "./utils/site-storage-lock";

/** The post files and access settings stored next to a post preview. */
export const readPostPreviewSourceEffect = Effect.fn(
  "Sites.readPostPreviewSource"
)(function* (siteId: string, previewKey: string) {
  const stored = yield* r2GetTextEffect(
    SITE_R2_KEYS.previewSource(siteId, previewKey)
  );
  const parsed = stored
    ? postPreviewSourceSchema.safeParse(safeJson(stored.text))
    : null;
  return parsed?.success ? parsed.data : null;
});

export function readPostPreviewSource(
  siteId: string,
  previewKey: string
): Promise<PostPreviewSource | null> {
  return runSitesEffect(readPostPreviewSourceEffect(siteId, previewKey));
}

export function writePostPreviewSource(
  siteId: string,
  previewKey: string,
  source: PostPreviewSource
): Promise<string> {
  return runSitesEffect(
    r2PutEffect(
      SITE_R2_KEYS.previewSource(siteId, previewKey),
      JSON.stringify(source),
      { contentType: "application/json" }
    )
  );
}

/** Deletes the source unless a preview written after this removal replaced it. */
export async function removePostPreviewSource(
  siteId: string,
  previewKey: string,
  generation: number
): Promise<void> {
  await withSiteStorageLock(siteId, async () => {
    const source = await readPostPreviewSource(siteId, previewKey);
    if (source && source.generation > generation) {
      return;
    }
    await r2DeleteKey(SITE_R2_KEYS.previewSource(siteId, previewKey));
  });
}
