import type {
  SiteManifest,
  SiteManifestFile,
} from "@notra/sites-core/types/deployment";
import { joinMountPath } from "@notra/sites-core/utils/mounts";

import { HTML_TYPES, LLMS_LINKS, MARKDOWN_TYPES } from "../constants/routing";

export function normalizeRequestPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) {
    return null;
  }
  const segments: string[] = [];
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      return null;
    }
    segments.push(segment);
  }
  const normalized = `/${segments.join("/")}`;
  return decoded.endsWith("/") && normalized !== "/"
    ? `${normalized}/`
    : normalized;
}

export function resolveFile(
  files: Map<string, SiteManifestFile>,
  path: string
): SiteManifestFile | null {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const candidates = path.endsWith("/")
    ? [`${trimmed}/index.html`]
    : [path, `${path}/index.html`, `${path}.html`];
  if (path === "/") {
    candidates.unshift("/index.html");
  }
  for (const candidate of candidates) {
    const file = files.get(candidate);
    if (file) {
      return file;
    }
  }
  return null;
}

export function trailingSlashPagePath(
  files: Map<string, SiteManifestFile>,
  path: string
): string | null {
  if (path === "/" || !path.endsWith("/")) {
    return null;
  }
  const bare = path.slice(0, -1);
  const file = resolveFile(files, path);
  if (!file?.path.endsWith(".html") || resolveFile(files, bare) !== file) {
    return null;
  }
  return bare.split("/").map(encodeURIComponent).join("/");
}

export function resolveMarkdownFile(
  files: Map<string, SiteManifestFile>,
  path: string
): SiteManifestFile | null {
  if (!path.endsWith(".md")) {
    return null;
  }
  return files.get(path) ?? files.get(`${path.slice(0, -3)}/index.md`) ?? null;
}

export function markdownTwin(
  files: Map<string, SiteManifestFile>,
  file: SiteManifestFile
): SiteManifestFile | null {
  return file.path.endsWith("/index.html")
    ? (files.get(`${file.path.slice(0, -".html".length)}.md`) ?? null)
    : null;
}

export function twinPagePath(twinPath: string): string | null {
  if (!twinPath.endsWith("/index.md")) {
    return null;
  }
  return twinPath.slice(0, -"/index.md".length) || "/";
}

export function markdownAlternatePath(
  files: Map<string, SiteManifestFile>,
  twinPath: string,
  mount: string | undefined
): string {
  const pagePath = twinPagePath(twinPath);
  return pagePath &&
    pagePath !== "/" &&
    pagePath !== mount &&
    !files.has(`${pagePath}.md`)
    ? `${pagePath}.md`
    : twinPath;
}

export function wellKnownLlmsTxtTarget(
  files: Map<string, SiteManifestFile>,
  path: string
): string | null {
  const resource = LLMS_LINKS.find(({ file }) =>
    path.endsWith(`/.well-known/${file}`)
  );
  if (!resource) {
    return null;
  }
  const target = `${path.slice(0, -`/.well-known/${resource.file}`.length)}/${resource.file}`;
  return files.has(target) ? target : null;
}

export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) {
    return false;
  }
  let markdown = 0;
  let html = 0;
  for (const part of accept.split(",")) {
    const [type = "", ...parameters] = part.trim().toLowerCase().split(";");
    const qParameter = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("q="));
    const quality = qParameter ? Number(qParameter.slice(2)) : 1;
    if (Number.isNaN(quality)) {
      continue;
    }
    if (MARKDOWN_TYPES.has(type.trim())) {
      markdown = Math.max(markdown, quality);
    } else if (HTML_TYPES.has(type.trim())) {
      html = Math.max(html, quality);
    }
  }
  return markdown > 0 && markdown >= html;
}

export function llmsLinkHeader(
  files: Map<string, SiteManifestFile>,
  mount: string
): string | null {
  const links = LLMS_LINKS.filter(({ file }) =>
    files.has(joinMountPath(mount, file))
  ).map(({ file, rel }) => `<${joinMountPath(mount, file)}>; rel="${rel}"`);
  return links.length > 0 ? links.join(", ") : null;
}
