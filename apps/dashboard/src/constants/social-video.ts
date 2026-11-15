import { ALLOWED_VIDEO_MIME_TYPES } from "@notra/schemas/constants/dashboard/upload";

import { MAX_CONTENT_VIDEO_BYTES } from "@/constants/content-video";

export const SOCIAL_VIDEO = {
  accept: ALLOWED_VIDEO_MIME_TYPES.join(","),
  contentTypes: new Set(["twitter_post", "linkedin_post"]),
  maxBytes: MAX_CONTENT_VIDEO_BYTES,
  maxBytesMb: MAX_CONTENT_VIDEO_BYTES / 1024 / 1024,
} as const;
