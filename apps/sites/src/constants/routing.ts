export const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);
export const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);
export const LLMS_LINKS = [
  { file: "llms.txt", rel: "llms-txt" },
  { file: "llms-full.txt", rel: "llms-full-txt" },
] as const;
