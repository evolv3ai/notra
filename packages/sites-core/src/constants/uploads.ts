/** Web image types and the extension each is saved with. */
export const IMAGE_MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
} as const;
/** Images the dashboard can upload into a site's public folder. */
export const SITE_IMAGE_UPLOAD_ACCEPT = `${Object.keys(IMAGE_MIME_EXTENSIONS).join(",")},.ico`;
/** Sent base64 in one request; 3 MB stays under Vercel's 4.5 MB body limit. */
export const SITE_IMAGE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
/** What an upload is for; decides how it is resized and encoded. */
export const SITE_IMAGE_UPLOAD_KINDS = [
  "background",
  "logo",
  "favicon",
  "share",
] as const;
/** Longest edge in pixels an upload of each kind is scaled down to. */
export const SITE_IMAGE_UPLOAD_MAX_EDGE = {
  background: 2560,
  logo: 512,
  favicon: 256,
  share: 1200,
} as const;
/** Largest file the browser accepts before scaling it down for upload. */
export const SITE_IMAGE_UPLOAD_INPUT_MAX_BYTES = 40 * 1024 * 1024;
/** Lands at /images/… on the site. */
export const SITE_IMAGE_UPLOAD_DIRECTORY = "public/images";
/** Names the dashboard gives uploads: `<stem>-<10 hex of the blob SHA>.<ext>`. */
export const SITE_IMAGE_UPLOAD_FILE = new RegExp(
  `^${SITE_IMAGE_UPLOAD_DIRECTORY}/[a-z0-9-]+-[0-9a-f]{10}\\.(?:png|jpg|gif|webp|avif|svg|ico)$`
);
/**
 * An upload in a built site, e.g. `/blog/images/hero-0123456789.webp`. The
 * capture is the start of its git blob SHA, so matching content is immutable.
 */
export const SITE_IMAGE_UPLOAD_OUTPUT_PATH =
  /\/images\/[a-z0-9-]+-([0-9a-f]{10})\.(?:png|jpg|gif|webp|avif|svg|ico)$/;
/** Image drafts are stored base64-encoded; every other draft is UTF-8 text. */
export const SITE_IMAGE_DRAFT_FILE =
  /^public\/.+\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i;
/** How long an upload nothing references survives without a later config save. */
export const SITE_IMAGE_UPLOAD_PRUNE_GRACE_MS = 10 * 60 * 1000;
