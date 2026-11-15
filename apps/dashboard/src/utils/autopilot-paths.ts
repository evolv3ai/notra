const SURROUNDING_SLASHES = /^\/+|\/+$/g;
const UNSAFE_PATH_CHARS = /[\\\0]/;
const PAGE_INDEX_FILES = new Set(["index", "page"]);
const MARKDOWN_EXTENSION = /\.mdx?$/;
const HTML_EXTENSION = /\.html?$/;
const TRAILING_SLASHES = /\/+$/;

/** Plain repository-relative paths only: no absolute paths, backslashes or dot segments. */
export function isSafeRepositoryPath(path: string) {
  if (!path || path.startsWith("/") || UNSAFE_PATH_CHARS.test(path)) {
    return false;
  }
  return path
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** "/content/blog/" → "content/blog"; null when the directory isn't a safe repository path. */
export function normalizeRepositoryDirectory(directory: string) {
  const trimmed = directory.trim().replace(SURROUNDING_SLASHES, "");
  return isSafeRepositoryPath(trimmed) ? trimmed : null;
}

/** Root files plus directories two levels deep with file counts, so an agent can orient without the full tree. */
export function summarizeRepositoryTree(paths: string[], maxLines: number) {
  const rootFiles: string[] = [];
  const directories = new Map<string, number>();
  for (const path of paths) {
    const segments = path.split("/");
    if (segments.length === 1) {
      rootFiles.push(path);
      continue;
    }
    for (const depth of [1, 2]) {
      if (segments.length > depth) {
        const directory = `${segments.slice(0, depth).join("/")}/`;
        directories.set(directory, (directories.get(directory) ?? 0) + 1);
      }
    }
  }
  const directoryLines = [...directories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([directory, count]) => `${directory} (${count} files)`);
  return [...rootFiles, ...directoryLines].slice(0, maxLines).join("\n");
}

/**
 * The Markdown file that renders a page URL, matched by the URL's last path
 * segment (blog/<slug>.mdx or <slug>/index.mdx). Null when none or several match.
 */
export function findPagePath(
  paths: readonly string[],
  url: string
): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const slug = pathname
    .replace(TRAILING_SLASHES, "")
    .split("/")
    .at(-1)
    ?.replace(HTML_EXTENSION, "");
  if (!slug) {
    return null;
  }
  const matches = paths.filter((path) => {
    if (!MARKDOWN_EXTENSION.test(path)) {
      return false;
    }
    const parts = path.split("/");
    const file = (parts.at(-1) ?? "").replace(MARKDOWN_EXTENSION, "");
    return (
      file === slug || (PAGE_INDEX_FILES.has(file) && parts.at(-2) === slug)
    );
  });
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
