import { posix } from "node:path";

import { IMPORTABLE_EXTENSIONS } from "../constants/builtins";
import { TEXT_SOURCE_FILE } from "../constants/validate";
import type { LineColumn, ResolvedImport } from "../types/paths";

export function resolveSiteImport(
  fromPath: string,
  source: string,
  files: ReadonlySet<string>
): ResolvedImport {
  if (
    !(
      source.startsWith("/") ||
      source.startsWith("./") ||
      source.startsWith("../")
    )
  ) {
    return {
      ok: false,
      message: `Cannot import "${source}": only files from this repository can be imported (start the path with / or ./). npm packages are not supported.`,
    };
  }
  const joined = source.startsWith("/")
    ? posix.normalize(source.slice(1))
    : posix.normalize(posix.join(posix.dirname(fromPath), source));
  if (joined.startsWith("..") || posix.isAbsolute(joined)) {
    return {
      ok: false,
      message: `Cannot import "${source}": the path leaves the site root`,
    };
  }
  const extension = posix.extname(joined).toLowerCase();
  const candidates = (IMPORTABLE_EXTENSIONS as readonly string[]).includes(
    extension
  )
    ? [joined]
    : IMPORTABLE_EXTENSIONS.map((ext) => `${joined}${ext}`);
  for (const candidate of candidates) {
    if (files.has(candidate)) {
      const candidateExtension = posix.extname(candidate).toLowerCase();
      return {
        ok: true,
        path: candidate,
        kind:
          candidateExtension === ".jsx" || candidateExtension === ".js"
            ? "component"
            : "content",
      };
    }
  }
  if (extension === ".json") {
    return {
      ok: false,
      message: `Cannot import "${source}": JSON imports are not supported`,
    };
  }
  return { ok: false, message: `Cannot import "${source}": file not found` };
}

let cachedSource: string | undefined;
let cachedLineBreaks: number[] = [];

function lineBreaks(source: string): number[] {
  if (source !== cachedSource) {
    const breaks: number[] = [];
    for (let index = 0; index < source.length; index += 1) {
      if (source.charCodeAt(index) === 10) {
        breaks.push(index);
      }
    }
    cachedSource = source;
    cachedLineBreaks = breaks;
  }
  return cachedLineBreaks;
}

export function offsetToLineColumn(source: string, offset: number): LineColumn {
  const breaks = lineBreaks(source);
  const end = Math.min(offset, source.length);
  let low = 0;
  let high = breaks.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((breaks[middle] ?? end) < end) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const lastBreak = low > 0 ? (breaks[low - 1] ?? -1) : -1;
  return { line: low + 1, column: offset - lastBreak };
}

export function isTextSourceFile(path: string): boolean {
  return TEXT_SOURCE_FILE.test(path);
}
