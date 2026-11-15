import { twinPagePath } from "./routing";

export function markdownPageHeaders(
  publicOrigin: string,
  twinPath: string
): Record<string, string> {
  const pagePath = twinPagePath(twinPath);
  return pagePath
    ? {
        "X-Robots-Tag": "noindex",
        Link: `<${new URL(pagePath, publicOrigin).href}>; rel="canonical"`,
      }
    : { "X-Robots-Tag": "noindex" };
}
