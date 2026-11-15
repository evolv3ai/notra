import { socialVideoAttachmentSchema } from "@notra/schemas/dashboard/content";

/** Media URLs for the video saved on a post, if it has a valid one. */
export function getSocialVideoUrls(sourceMetadata: unknown): string[] {
  if (
    !sourceMetadata ||
    typeof sourceMetadata !== "object" ||
    !("socialVideo" in sourceMetadata)
  ) {
    return [];
  }
  const parsed = socialVideoAttachmentSchema.safeParse(
    sourceMetadata.socialVideo
  );
  return parsed.success ? [parsed.data.url] : [];
}
