export function parseOgWebsiteUrl(value: string | null) {
  if (!value) {
    return null;
  }
  const candidate = URL.canParse(value) ? value : `https://${value}`;
  if (!URL.canParse(candidate)) {
    return null;
  }
  const url = new URL(candidate);
  return url.protocol === "https:" || url.protocol === "http:" ? url : null;
}
