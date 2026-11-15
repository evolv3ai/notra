import {
  IMAGE_MIME_EXTENSIONS,
  SITE_IMAGE_DRAFT_FILE,
} from "@notra/sites-core/constants/uploads";

export function isSiteImageDraftPath(path: string): boolean {
  return SITE_IMAGE_DRAFT_FILE.test(path);
}

/** `public/images/a.png` is served at `/images/a.png`. */
export function sitePublicAssetPath(path: string): string {
  return path.startsWith("public/") ? path.slice("public".length) : `/${path}`;
}

export function siteImageMimeType(path: string): string {
  const extension = path
    .slice(path.lastIndexOf(".") + 1)
    .toLowerCase()
    .replace(/^jpeg$/, "jpg");
  const match = Object.entries(IMAGE_MIME_EXTENSIONS).find(
    ([, known]) => known === extension
  );
  return match?.[0] ?? "application/octet-stream";
}
