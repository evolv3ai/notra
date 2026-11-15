import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { slugify } from "@notra/utils/slugify";
import { fromMarkdown } from "mdast-util-from-markdown";
import { Document, isMap, parseDocument, Scalar } from "yaml";

import {
  FRONTMATTER_BLOCK,
  FRONTMATTER_AUTHOR_LINE,
  SITE_ENTRY_AUTHOR_FIELDS,
  UNQUOTED_YAML_COMMENT,
  LEADING_BLANK_LINES,
  LEADING_ATX_HEADING,
  WHITESPACE_RUN,
  TRAILING_PUNCTUATION,
  SURROUNDING_SLASHES,
  SITE_IMAGE_URL,
  ELLIPSIS,
  SITE_ENTRY_DESCRIPTION_MAX_LENGTH,
  SITE_ENTRY_DIRECTORIES,
  SITE_ENTRY_FALLBACK_SLUG,
  SITE_IMAGE_DIRECTORY,
  SITE_PUBLIC_DIRECTORY,
} from "@/constants/site-github-publish";
import { SiteEntryFrontmatterError } from "@/lib/errors/site-entry";
import { siteConfigAuthorsSchema } from "@/schemas/site-github-publish";
import type { GitHubPublishContentType } from "@/types/integrations/github";
import type {
  ResolveSiteEntrySlugParams,
  BuildSiteEntryMarkdownParams,
  SiteConfigAuthorNames,
  SiteEntryAuthor,
  SiteMarkdownNode,
} from "@/types/integrations/site-github-publish";

function joinRepositoryPath(...segments: string[]): string {
  return segments
    .map((segment) => segment.replace(SURROUNDING_SLASHES, ""))
    .filter(Boolean)
    .join("/");
}

export function normalizeSiteRootDirectory(rootDirectory: string): string {
  return rootDirectory.replace(SURROUNDING_SLASHES, "");
}

export function resolveSiteConfigPath(rootDirectory: string): string {
  return joinRepositoryPath(rootDirectory, SITE_CONFIG_FILENAME);
}

export function resolveSiteEntryDirectory(
  rootDirectory: string,
  contentType: GitHubPublishContentType
): string {
  return joinRepositoryPath(rootDirectory, SITE_ENTRY_DIRECTORIES[contentType]);
}

export function resolveSitePublicDirectory(rootDirectory: string): string {
  return joinRepositoryPath(rootDirectory, SITE_PUBLIC_DIRECTORY);
}

export function resolveSiteImagePathTemplate(
  rootDirectory: string,
  contentType: GitHubPublishContentType
): string {
  return joinRepositoryPath(
    resolveSitePublicDirectory(rootDirectory),
    SITE_IMAGE_DIRECTORY,
    SITE_ENTRY_DIRECTORIES[contentType],
    ":slug/image"
  );
}

export function resolveSiteEntrySlug(
  params: ResolveSiteEntrySlugParams
): string {
  return (
    slugify(params.slug ?? "") ||
    slugify(params.title) ||
    slugify(params.contentId) ||
    SITE_ENTRY_FALLBACK_SLUG
  );
}

export function resolveSiteAuthor(
  authors: SiteConfigAuthorNames,
  name: string | null | undefined
): string | null {
  const trimmed = name?.trim();
  if (!trimmed) {
    return null;
  }
  const wanted = trimmed.toLowerCase();
  const match = Object.entries(authors).find(
    ([, authorName]) => authorName.trim().toLowerCase() === wanted
  );
  return match ? match[0] : trimmed;
}

export function parseSiteConfigAuthors(raw: string): SiteConfigAuthorNames {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {};
  }
  const parsed = siteConfigAuthorsSchema.safeParse(json);
  if (!(parsed.success && parsed.data.authors)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed.data.authors).map(([id, author]) => [id, author.name])
  );
}

function parseYamlScalar(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("'")) {
    return trimmed.endsWith("'") && trimmed.length > 1
      ? trimmed.slice(1, -1).replaceAll("''", "'")
      : null;
  }
  if (!trimmed || "[{|>&*!".includes(trimmed[0] ?? "")) {
    return null;
  }
  return trimmed.replace(UNQUOTED_YAML_COMMENT, "") || null;
}

export function readSiteEntryAuthor(markdown: string): string | null {
  const block = FRONTMATTER_BLOCK.exec(markdown)?.[1];
  const line = block ? FRONTMATTER_AUTHOR_LINE.exec(block)?.[1] : undefined;
  return line === undefined ? null : parseYamlScalar(line);
}

function normalizeHeadingText(value: string): string {
  return value.replace(WHITESPACE_RUN, " ").trim().toLowerCase();
}

function stripLeadingTitleHeading(body: string, title: string): string {
  const withoutBlankLines = body.replace(LEADING_BLANK_LINES, "");
  const heading = LEADING_ATX_HEADING.exec(withoutBlankLines);
  if (
    !(
      heading?.[1] &&
      normalizeHeadingText(heading[1]) === normalizeHeadingText(title)
    )
  ) {
    return body;
  }
  return withoutBlankLines
    .slice(heading[0].length)
    .replace(LEADING_BLANK_LINES, "");
}

function collectText(node: SiteMarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value ?? "";
  }
  if (node.type === "break") {
    return " ";
  }
  if (node.type === "image" || node.type === "html") {
    return "";
  }
  return (node.children ?? []).map(collectText).join("");
}

function truncateOnWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const room = text.slice(0, maxLength - ELLIPSIS.length + 1);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room.slice(0, -1);
  return `${cut.replace(TRAILING_PUNCTUATION, "")}${ELLIPSIS}`;
}

export function extractMarkdownExcerpt(
  markdown: string,
  maxLength: number = SITE_ENTRY_DESCRIPTION_MAX_LENGTH
): string {
  const tree = fromMarkdown(markdown) as SiteMarkdownNode;
  for (const node of tree.children ?? []) {
    if (node.type !== "paragraph") {
      continue;
    }
    const text = collectText(node).replace(WHITESPACE_RUN, " ").trim();
    if (text) {
      return truncateOnWordBoundary(text, maxLength);
    }
  }
  return "";
}

function findFirstImageUrl(node: SiteMarkdownNode): string | null {
  if (node.type === "image") {
    return node.url ?? null;
  }
  for (const child of node.children ?? []) {
    const url = findFirstImageUrl(child);
    if (url !== null) {
      return url;
    }
  }
  return null;
}

function findSiteEntryImage(markdown: string): string | null {
  const url = findFirstImageUrl(fromMarkdown(markdown) as SiteMarkdownNode);
  return url && SITE_IMAGE_URL.test(url) ? url : null;
}

function formatSiteEntryDate(date: Date): string {
  return date.toISOString().slice(0, "YYYY-MM-DD".length);
}

function parseFrontmatter(markdown: string | null | undefined): {
  document: Document | null;
  body: string;
  invalid: boolean;
} {
  if (!markdown) {
    return { document: null, body: "", invalid: false };
  }
  const match = FRONTMATTER_BLOCK.exec(markdown);
  if (!match) {
    return { document: null, body: markdown, invalid: false };
  }
  const document = parseDocument(match[1] ?? "");
  const isMapping =
    document.errors.length === 0 &&
    (document.contents === null || isMap(document.contents));
  return {
    document: isMapping ? document : null,
    body: markdown.slice(match[0].length),
    invalid: !isMapping,
  };
}

function plainScalar(value: string): Scalar {
  const scalar = new Scalar(value);
  scalar.type = Scalar.PLAIN;
  return scalar;
}

function authorNode(author: SiteEntryAuthor): Record<string, string> {
  const node: Record<string, string> = { id: author.id, name: author.name };
  for (const key of SITE_ENTRY_AUTHOR_FIELDS) {
    const value = author[key]?.trim();
    if (value) {
      node[key] = value;
    }
  }
  return node;
}

/**
 * Builds the entry file for a hosted site. Keys Notra manages are written
 * from Notra on every publish, and removed when cleared there. Every other
 * key in the repository file (added by hand, by another tool) is kept, in
 * its original order. Frontmatter written in the editor wins over both.
 */
export function buildSiteEntryMarkdown(
  params: BuildSiteEntryMarkdownParams
): string {
  const own = parseFrontmatter(params.markdown);
  if (own.invalid) {
    throw new SiteEntryFrontmatterError();
  }
  const existing = parseFrontmatter(params.existingMarkdown);
  const document = existing.document ?? new Document({});
  const ownKeys = new Set<string>();
  if (own.document && isMap(own.document.contents)) {
    for (const pair of own.document.contents.items) {
      document.set(pair.key, pair.value);
      ownKeys.add(String(pair.key));
    }
  }
  const body = own.document
    ? own.body
    : stripLeadingTitleHeading(params.markdown, params.title);
  const metadata = params.metadata ?? {};
  const isBlog = params.contentType === "blog_post";
  const autoFill = !own.document;
  const write = (key: string, value: unknown) => {
    if (ownKeys.has(key)) {
      return;
    }
    if (value === null || value === undefined) {
      document.delete(key);
    } else {
      document.set(key, value);
    }
  };

  if (document.get("title") !== params.title) {
    document.set("title", params.title);
  }

  write(
    "description",
    metadata.description?.trim() ||
      (autoFill ? extractMarkdownExcerpt(body) || null : null)
  );

  write("date", plainScalar(formatSiteEntryDate(metadata.date ?? params.date)));
  const date = String(document.get("date") ?? "");
  if (params.updated) {
    const updated = formatSiteEntryDate(params.updated);
    if (updated >= date) {
      write("updated", plainScalar(updated));
    }
  }

  const authors = isBlog ? (metadata.authors ?? []) : [];
  if (authors.length === 1 && authors[0]) {
    write("author", authorNode(authors[0]));
  } else if (authors.length > 1) {
    write("author", authors.map(authorNode));
  } else {
    write("author", isBlog ? params.author?.trim() || null : null);
  }

  const image =
    metadata.image ??
    (autoFill ? { src: findSiteEntryImage(body), alt: "" } : null);
  write("image", image?.src || null);
  write("imageAlt", (image?.src && image.alt.trim()) || null);

  write(
    "tags",
    metadata.tags && metadata.tags.length > 0 ? metadata.tags : null
  );

  write("featured", isBlog && metadata.featured ? true : null);
  write("noindex", isBlog && metadata.noindex ? true : null);
  write("hidden", metadata.hidden ? true : null);

  const yaml = document
    .toString({
      defaultKeyType: "PLAIN",
      defaultStringType: "QUOTE_DOUBLE",
      lineWidth: 0,
    })
    .trimEnd();
  return own.document
    ? `---\n${yaml}\n---\n${body}`
    : `---\n${yaml}\n---\n\n${body.replace(LEADING_BLANK_LINES, "")}`;
}
