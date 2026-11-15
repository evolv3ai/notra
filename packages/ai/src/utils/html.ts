const EMBEDDED_IMAGE_DATA_URL_RE =
  /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i;

export function isEmbeddedImageDataUrl(value: string) {
  return EMBEDDED_IMAGE_DATA_URL_RE.test(value);
}
