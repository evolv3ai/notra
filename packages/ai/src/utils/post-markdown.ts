import { LEADING_FRONTMATTER } from "@notra/ai/constants/post-metadata";

/**
 * Drops a leading frontmatter block. Notra keeps title, slug, and other
 * metadata in their own columns, so a copied block would render as text.
 */
export function stripLeadingFrontmatter(markdown: string): string {
  const match = LEADING_FRONTMATTER.exec(markdown);
  return match
    ? markdown.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, "")
    : markdown;
}
