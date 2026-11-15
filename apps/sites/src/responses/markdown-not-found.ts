import type { MarkdownNotFoundParams } from "../types/serving";

export function markdownNotFound(params: MarkdownNotFoundParams): Response {
  const lines = [
    "# Not found",
    "",
    `There is no page at \`${params.path.replaceAll("`", "")}\`. It may have moved, or the link is wrong.`,
    "",
  ];
  if (params.indexPath) {
    lines.push(`- [Index](${params.indexPath}): every entry, newest first`);
  }
  lines.push(`- [llms.txt](${params.llmsPath}): a Markdown map of this site`);
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
    Vary: "Accept",
  });
  return new Response(`${lines.join("\n")}\n`, { status: 404, headers });
}
