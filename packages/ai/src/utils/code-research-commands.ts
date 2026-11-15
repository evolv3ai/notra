import { posix } from "node:path";

import {
  CODE_RESEARCH_COMMAND_TIMEOUT_SECONDS,
  CODE_RESEARCH_DEEPEN_STEPS,
  CODE_RESEARCH_DENIED_PATH_PATTERNS,
  CODE_RESEARCH_DIFF_EXCLUDES,
  CODE_RESEARCH_DIFF_MAX_BYTES,
  CODE_RESEARCH_ENV_SECRET_PATTERN,
  CODE_RESEARCH_EXIT_MARKER,
  CODE_RESEARCH_FALLBACK_DEPTH,
  CODE_RESEARCH_FILENAME_MAX_LENGTH,
  CODE_RESEARCH_FULL_SHA_PATTERN,
  CODE_RESEARCH_HISTORY_DAYS,
  CODE_RESEARCH_LINE_MAX_CHARS,
  CODE_RESEARCH_LIST_SCAN_LIMIT,
  CODE_RESEARCH_OVERVIEW_COMMITS,
  CODE_RESEARCH_OVERVIEW_MANIFESTS,
  CODE_RESEARCH_PATH_MAX_LENGTH,
  CODE_RESEARCH_QUOTED_SECRET_PATTERN,
  CODE_RESEARCH_README_MAX_LINES,
  CODE_RESEARCH_UNQUOTED_SECRET_PATTERN,
  CODE_RESEARCH_URL_CREDENTIALS_PATTERN,
  CODE_RESEARCH_READ_MAX_BYTES,
  CODE_RESEARCH_REDACTED,
  CODE_RESEARCH_REDACTION_PATTERNS,
  CODE_RESEARCH_REPO_DIR,
  CODE_RESEARCH_SEARCH_MAX_LINES,
  CODE_RESEARCH_INVALID_REF_CHARS,
  CODE_RESEARCH_MAX_REF_LENGTH,
} from "@notra/ai/constants/code-research";
import type {
  CodeResearchCommandResult,
  CodeResearchCommit,
  CodeResearchRepository,
  CodeResearchSearchMatch,
  CodeResearchTarget,
} from "@notra/ai/types/code-research";
import { shellQuote } from "@notra/ai/utils/shell";

const FIELD_SEPARATOR = "\u001f";
const COMMIT_FORMAT = "%H%x1f%an%x1f%aI%x1f%s";
const GITHUB_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const SEARCH_LINE_PATTERN = /^(.*?):(\d+):(.*)$/;
const SEARCH_LINE_SEPARATOR_PATTERN = /:(?=\d+:)/g;
const DIFF_FILE_HEADER_PATTERN = /^diff --git a\/(.*) b\/(.*)$/;
const STAT_LINE_PATTERN = /^\s*(.+?)\s+\|\s+(?:\d+|Bin)/;
const RENAME_BRACES_PATTERN = /\{([^{}]*?) => ([^{}]*?)\}/;
const GIT = "git -c core.quotePath=false";
const CREDENTIAL_FREE_GIT =
  "GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c core.quotePath=false";
const EXCLUDED_PATHSPECS = CODE_RESEARCH_DIFF_EXCLUDES.map((pattern) =>
  shellQuote(`:(exclude,glob)**/${pattern}`)
).join(" ");

/**
 * Runs a script inside the repository with a hard timeout. stderr is merged
 * and the exit code is printed as a trailer, because the Box API drops stdout
 * whenever a command exits non-zero.
 */
export function wrapCommand(
  script: string,
  options?: { cwd?: string; timeoutSeconds?: number }
): string {
  const cwd = options?.cwd ?? CODE_RESEARCH_REPO_DIR;
  const timeout =
    options?.timeoutSeconds ?? CODE_RESEARCH_COMMAND_TIMEOUT_SECONDS;
  return `cd ${shellQuote(cwd)} && timeout ${timeout} sh -c ${shellQuote(
    script
  )} 2>&1; printf '\\n%s%s' ${shellQuote(CODE_RESEARCH_EXIT_MARKER)} "$?"`;
}

export function parseCommandOutput(
  result: string,
  fallbackExitCode: number | null
): CodeResearchCommandResult {
  const markerIndex = result.lastIndexOf(`\n${CODE_RESEARCH_EXIT_MARKER}`);
  if (markerIndex === -1) {
    return { exitCode: fallbackExitCode ?? 1, output: result };
  }
  const exitCode = Number.parseInt(
    result.slice(markerIndex + CODE_RESEARCH_EXIT_MARKER.length + 1),
    10
  );
  return {
    exitCode: Number.isNaN(exitCode) ? 1 : exitCode,
    output: result.slice(0, markerIndex),
  };
}

export function normalizeRepoPath(input: string | undefined): string {
  const trimmed = (input ?? "").trim().replace(/^\.\/+/, "");
  if (trimmed.length === 0 || trimmed === ".") {
    return "";
  }
  if (trimmed.startsWith("/") || trimmed.includes("\0")) {
    throw new Error(`Path "${input}" must be relative to the repository root.`);
  }
  const normalized = posix.normalize(trimmed).replace(/\/+$/, "");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Path "${input}" points outside the repository.`);
  }
  return normalized === "." ? "" : normalized;
}

export function isDeniedRepoPath(path: string): boolean {
  return CODE_RESEARCH_DENIED_PATH_PATTERNS.some((pattern) =>
    pattern.test(path)
  );
}

/**
 * Every deny pattern matches on the final path segment, so only that segment
 * of each candidate is checked. Real paths stay within PATH_MAX and NAME_MAX,
 * which keeps the work per line bounded however many separators it has.
 */
function hasDeniedCandidatePath(line: string): boolean {
  for (const match of line.matchAll(SEARCH_LINE_SEPARATOR_PATTERN)) {
    const end = match.index;
    if (end > CODE_RESEARCH_PATH_MAX_LENGTH) {
      return false;
    }
    const start = line.lastIndexOf("/", end - 1) + 1;
    if (
      end - start <= CODE_RESEARCH_FILENAME_MAX_LENGTH &&
      isDeniedRepoPath(line.slice(start, end))
    ) {
      return true;
    }
  }
  return false;
}

export function assertReadableRepoPath(path: string): void {
  if (isDeniedRepoPath(path)) {
    throw new Error(
      `"${path}" may contain secrets and cannot be read. Look at an example or template file instead.`
    );
  }
}

export function redactSecrets(text: string): string {
  let redacted = text;
  for (const pattern of CODE_RESEARCH_REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, CODE_RESEARCH_REDACTED);
  }
  return redacted
    .replace(
      CODE_RESEARCH_QUOTED_SECRET_PATTERN,
      (_match, key: string, quote: string) =>
        `${key}${quote}${CODE_RESEARCH_REDACTED}${quote}`
    )
    .replace(
      CODE_RESEARCH_ENV_SECRET_PATTERN,
      (_match, key: string) => `${key}${CODE_RESEARCH_REDACTED}`
    )
    .replace(
      CODE_RESEARCH_UNQUOTED_SECRET_PATTERN,
      (_match, key: string) => `${key}${CODE_RESEARCH_REDACTED}`
    )
    .replace(
      CODE_RESEARCH_URL_CREDENTIALS_PATTERN,
      (_match, prefix: string, _secret: string, at: string) =>
        `${prefix}${CODE_RESEARCH_REDACTED}${at}`
    );
}

export function truncateText(
  text: string,
  maxBytes: number
): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) {
    return { text, truncated: false };
  }
  const sliced = Buffer.from(text, "utf8")
    .subarray(0, maxBytes)
    .toString("utf8")
    .replace(/�$/, "");
  return { text: sliced, truncated: true };
}

const FIRST_PRINTABLE_CODE_POINT = 0x20;
const DELETE_CODE_POINT = 0x7f;

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < FIRST_PRINTABLE_CODE_POINT || code === DELETE_CODE_POINT) {
      return true;
    }
  }
  return false;
}

// Follows git-check-ref-format; values are shell-quoted separately.
function assertSafeRef(ref: string, label: string): string {
  const trimmed = ref.trim();
  const isValid =
    trimmed.length > 0 &&
    trimmed.length <= CODE_RESEARCH_MAX_REF_LENGTH &&
    !CODE_RESEARCH_INVALID_REF_CHARS.test(trimmed) &&
    !hasControlCharacters(trimmed) &&
    !trimmed.startsWith("-") &&
    !trimmed.startsWith("/") &&
    !trimmed.endsWith("/") &&
    !trimmed.endsWith(".") &&
    !trimmed.endsWith(".lock") &&
    !trimmed.includes("..") &&
    !trimmed.includes("//") &&
    !trimmed.includes("@{") &&
    trimmed !== "@" &&
    !trimmed.split("/").some((segment) => segment.startsWith("."));
  if (!isValid) {
    throw new Error(`Invalid ${label} "${ref}".`);
  }
  return trimmed;
}

function assertGitHubName(value: string, label: string): string {
  if (!GITHUB_NAME_PATTERN.test(value)) {
    throw new Error(`Invalid GitHub ${label} "${value}".`);
  }
  return value;
}

function fetchWithFallback(refspec: string): string {
  const quoted = shellQuote(refspec);
  return `{ ${CREDENTIAL_FREE_GIT} fetch --quiet --no-tags --shallow-since=${CODE_RESEARCH_HISTORY_DAYS}.days.ago origin ${quoted} || ${CREDENTIAL_FREE_GIT} fetch --quiet --no-tags --depth=${CODE_RESEARCH_FALLBACK_DEPTH} origin ${quoted}; }`;
}

export function buildCloneScript(repository: CodeResearchRepository): string {
  const owner = assertGitHubName(repository.owner, "owner");
  const repo = assertGitHubName(repository.repo, "repository");
  const branch = shellQuote(assertSafeRef(repository.defaultBranch, "branch"));
  const url = shellQuote(`https://github.com/${owner}/${repo}.git`);
  const dir = shellQuote(CODE_RESEARCH_REPO_DIR);
  const clone = (history: string) =>
    `${CREDENTIAL_FREE_GIT} clone --quiet --single-branch --no-tags ${history} --branch ${branch} ${url} ${dir}`;
  // Repositories without commits in the window fail the shallow-since clone.
  return [
    `rm -rf ${dir}`,
    `{ ${clone(`--shallow-since=${CODE_RESEARCH_HISTORY_DAYS}.days.ago`)} || { rm -rf ${dir} && ${clone(`--depth=${CODE_RESEARCH_FALLBACK_DEPTH}`)}; }; }`,
    `cd ${dir}`,
    `${GIT} rev-parse HEAD`,
  ].join(" && ");
}

export function buildCheckoutScript(
  target: CodeResearchTarget,
  defaultBranch: string
): string {
  const checkout = (ref: string) =>
    `${GIT} checkout --quiet --detach ${shellQuote(ref)} && ${GIT} rev-parse HEAD`;

  switch (target.kind) {
    case "default": {
      const branch = assertSafeRef(defaultBranch, "branch");
      return checkout(`refs/remotes/origin/${branch}`);
    }
    case "branch": {
      const branch = assertSafeRef(target.branch, "branch");
      const local = `refs/remotes/origin/${branch}`;
      return `${fetchWithFallback(`+refs/heads/${branch}:${local}`)} && ${checkout(local)}`;
    }
    case "pull_request": {
      if (!(Number.isInteger(target.number) && target.number > 0)) {
        throw new Error(`Invalid pull request number ${target.number}.`);
      }
      const local = `refs/remotes/origin/pr/${target.number}`;
      return `${fetchWithFallback(`+refs/pull/${target.number}/head:${local}`)} && ${checkout(local)}`;
    }
    case "commit": {
      const sha = target.sha.trim().toLowerCase();
      if (!CODE_RESEARCH_FULL_SHA_PATTERN.test(sha)) {
        throw new Error(
          "Commit checkouts need the full 40-character SHA. Use repository_history to look it up."
        );
      }
      return `{ ${GIT} cat-file -e ${shellQuote(`${sha}^{commit}`)} 2>/dev/null || ${fetchWithFallback(sha)}; } && ${checkout(sha)}`;
    }
    default: {
      const exhaustive: never = target;
      throw new Error(`Unknown target ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function describeTarget(target: CodeResearchTarget): string {
  switch (target.kind) {
    case "default":
      return "default branch";
    case "branch":
      return `branch ${target.branch}`;
    case "pull_request":
      return `pull request #${target.number}`;
    case "commit":
      return `commit ${target.sha.slice(0, 12)}`;
    default: {
      const exhaustive: never = target;
      return JSON.stringify(exhaustive);
    }
  }
}

export function isSameTarget(
  left: CodeResearchTarget,
  right: CodeResearchTarget
): boolean {
  return describeTarget(left) === describeTarget(right);
}

export function parseHeadSha(output: string): string {
  const sha = output.trim().split("\n").at(-1)?.trim() ?? "";
  if (!CODE_RESEARCH_FULL_SHA_PATTERN.test(sha)) {
    throw new Error(
      `Could not resolve the checked out commit: ${output.trim()}`
    );
  }
  return sha;
}

const OVERVIEW_SECTIONS = [
  "HEAD",
  "TREE",
  "README",
  "MANIFESTS",
  "COMMITS",
] as const;
type OverviewSection = (typeof OVERVIEW_SECTIONS)[number];

export function buildOverviewScript(sha: string): string {
  const commit = shellQuote(assertFullSha(sha));
  const manifests = shellQuote(
    "(^|/)(package\\.json|pyproject\\.toml|Cargo\\.toml|go\\.mod|composer\\.json|Gemfile|pom\\.xml|build\\.gradle)$"
  );
  return [
    "echo @@HEAD",
    `${GIT} log -1 --format=${shellQuote(COMMIT_FORMAT)} ${commit}`,
    "echo @@TREE",
    `${GIT} ls-tree --format=${shellQuote("%(objecttype) %(path)")} ${commit}`,
    "echo @@README",
    `f=$(${GIT} ls-tree --name-only ${commit} | grep -i -m1 -E ${shellQuote("^readme(\\.(md|mdx|rst|txt))?$")}); if [ -n "$f" ]; then echo "$f"; ${GIT} show ${commit}:"$f" | head -n ${CODE_RESEARCH_README_MAX_LINES}; fi`,
    "echo @@MANIFESTS",
    `${GIT} ls-tree -r --name-only ${commit} | grep -E ${manifests} | head -n ${CODE_RESEARCH_OVERVIEW_MANIFESTS}`,
    "echo @@COMMITS",
    `${GIT} log -n ${CODE_RESEARCH_OVERVIEW_COMMITS} --format=${shellQuote(COMMIT_FORMAT)} ${commit}`,
  ].join("; ");
}

function splitSections(output: string): Record<OverviewSection, string> {
  const sections = Object.fromEntries(
    OVERVIEW_SECTIONS.map((section) => [section, ""])
  ) as Record<OverviewSection, string>;
  let current: OverviewSection | null = null;
  const buffers = new Map<OverviewSection, string[]>();
  for (const line of output.split("\n")) {
    const header = OVERVIEW_SECTIONS.find((section) => line === `@@${section}`);
    if (header) {
      current = header;
      buffers.set(header, []);
      continue;
    }
    if (current) {
      buffers.get(current)?.push(line);
    }
  }
  for (const [section, lines] of buffers) {
    sections[section] = lines.join("\n").trim();
  }
  return sections;
}

export function parseCommitLines(output: string): CodeResearchCommit[] {
  return output
    .split("\n")
    .map((line) => line.split(FIELD_SEPARATOR))
    .filter((fields) => fields.length >= 4 && fields[0])
    .map(([sha = "", author = "", date = "", ...subject]) => ({
      sha,
      author: redactSecrets(author),
      date,
      subject: redactSecrets(subject.join(FIELD_SEPARATOR)),
    }));
}

export function parseOverview(output: string) {
  const sections = splitSections(output);
  const [readmePath = null, ...readmeLines] = sections.README
    ? sections.README.split("\n")
    : [];
  return {
    head: parseCommitLines(sections.HEAD)[0] ?? null,
    topLevel: sections.TREE.split("\n")
      .filter(Boolean)
      .map((line) => {
        const [type = "", ...rest] = line.split(" ");
        const path = rest.join(" ");
        return type === "tree" ? `${path}/` : path;
      }),
    readme: readmePath
      ? { path: readmePath, excerpt: redactSecrets(readmeLines.join("\n")) }
      : null,
    manifests: sections.MANIFESTS.split("\n").filter(Boolean),
    recentCommits: parseCommitLines(sections.COMMITS),
  };
}

function pathspecFor(path: string, glob: string | undefined): string {
  if (glob?.trim()) {
    const pattern = glob.trim().replace(/^\/+/, "");
    return shellQuote(`:(glob)${path ? `${path}/` : ""}${pattern}`);
  }
  return shellQuote(path || ".");
}

function assertFullSha(sha: string): string {
  if (!CODE_RESEARCH_FULL_SHA_PATTERN.test(sha)) {
    throw new Error(`Invalid commit ${sha}.`);
  }
  return sha;
}

/**
 * Reads run against the recorded commit, never the working tree, so a
 * concurrent checkout of another ref cannot change what they see.
 */
export function buildListFilesScript(
  sha: string,
  path: string,
  glob?: string
): string {
  const filter = glob?.trim()
    ? ` | grep -E ${shellQuote(globToPathPattern(path, glob))}`
    : "";
  return `${GIT} ls-tree -r --name-only ${shellQuote(assertFullSha(sha))} -- ${shellQuote(path || ".")}${filter} | head -n ${CODE_RESEARCH_LIST_SCAN_LIMIT + 1}`;
}

function globToPathPattern(basePath: string, glob: string): string {
  const prefix = basePath
    ? `${basePath}/`.replace(/[.+^${}()|[\]\\*?]/g, "\\$&")
    : "";
  return `^${prefix}${globToRegExp(glob).source.slice(1).replaceAll("\\/", "/")}`;
}

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  const source = glob.trim().replace(/^\/+/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (char === "*" && source[index + 1] === "*") {
      const followedBySlash = source[index + 2] === "/";
      pattern += followedBySlash ? "(.*/)?" : ".*";
      index += followedBySlash ? 2 : 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

const GLOB_LITERAL = 0;
const GLOB_CHAR = 1;
const GLOB_STAR = 2;
const GLOB_GLOBSTAR = 3;
const GLOB_GLOBSTAR_SLASH = 4;
const SLASH_CODE = 47;

/**
 * Matches a glob by simulating all token positions at once: a single star is
 * [^/]*, `?` is [^/], a double star is .*, and a double star followed by a
 * slash is an optional run ending in a slash. Work is bounded by tokens times
 * path length, unlike a backtracking RegExp, where a model-chosen glob with
 * many stars can take seconds per filename.
 */
function createGlobMatcher(glob: string) {
  const kinds: number[] = [];
  const chars: number[] = [];
  const source = glob.trim().replace(/^\/+/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (char === "*" && source[index + 1] === "*") {
      const followedBySlash = source[index + 2] === "/";
      kinds.push(followedBySlash ? GLOB_GLOBSTAR_SLASH : GLOB_GLOBSTAR);
      index += followedBySlash ? 2 : 1;
    } else if (char === "*") {
      kinds.push(GLOB_STAR);
    } else if (char === "?") {
      kinds.push(GLOB_CHAR);
    } else {
      kinds.push(GLOB_LITERAL);
    }
    chars.push(char.charCodeAt(0));
  }
  const count = kinds.length;
  // matched[j]: the first j tokens match the input so far.
  // inside[j]: token j is a double star with slash, mid-way through its run.
  let matched = new Uint8Array(count + 1);
  let inside = new Uint8Array(count);
  let nextMatched = new Uint8Array(count + 1);
  let nextInside = new Uint8Array(count);
  const close = (states: Uint8Array, runs: Uint8Array) => {
    let alive = states[0] === 1;
    for (let j = 0; j < count; j += 1) {
      const kind = kinds[j] ?? GLOB_LITERAL;
      if (states[j] && kind >= GLOB_STAR) {
        states[j + 1] = 1;
        if (kind === GLOB_GLOBSTAR_SLASH) {
          runs[j] = 1;
        }
      }
      alive ||= states[j + 1] === 1 || runs[j] === 1;
    }
    return alive;
  };
  return (path: string) => {
    matched.fill(0);
    inside.fill(0);
    matched[0] = 1;
    close(matched, inside);
    for (let index = 0; index < path.length; index += 1) {
      const code = path.charCodeAt(index);
      nextMatched.fill(0);
      nextInside.fill(0);
      for (let j = 0; j < count; j += 1) {
        const kind = kinds[j];
        if (kind === GLOB_LITERAL) {
          if (matched[j] && code === chars[j]) {
            nextMatched[j + 1] = 1;
          }
        } else if (kind === GLOB_CHAR) {
          if (matched[j] && code !== SLASH_CODE) {
            nextMatched[j + 1] = 1;
          }
        } else if (kind === GLOB_STAR) {
          if (matched[j + 1] && code !== SLASH_CODE) {
            nextMatched[j + 1] = 1;
          }
        } else if (kind === GLOB_GLOBSTAR) {
          if (matched[j + 1]) {
            nextMatched[j + 1] = 1;
          }
        } else if (inside[j]) {
          nextInside[j] = 1;
          if (code === SLASH_CODE) {
            nextMatched[j + 1] = 1;
          }
        }
      }
      const alive = close(nextMatched, nextInside);
      [matched, nextMatched] = [nextMatched, matched];
      [inside, nextInside] = [nextInside, inside];
      if (!alive) {
        return false;
      }
    }
    return matched[count] === 1;
  };
}

export function parseListFiles(
  output: string,
  basePath: string,
  maxEntries: number,
  glob?: string
) {
  const lines = output.split("\n").filter(Boolean);
  const scanTruncated = lines.length > CODE_RESEARCH_LIST_SCAN_LIMIT;
  const prefix = basePath ? `${basePath}/` : "";
  const matches = glob?.trim() ? createGlobMatcher(glob) : null;
  const allFiles = lines
    .slice(0, CODE_RESEARCH_LIST_SCAN_LIMIT)
    .filter((file) =>
      matches
        ? matches(file.startsWith(prefix) ? file.slice(prefix.length) : file)
        : true
    );
  const totalFiles = allFiles.length;
  if (allFiles.length <= maxEntries) {
    return {
      path: basePath,
      totalFiles,
      truncated: scanTruncated,
      files: allFiles,
      directories: [],
    };
  }

  const directFiles: string[] = [];
  const directoryCounts = new Map<string, number>();
  for (const file of allFiles) {
    const relative = file.startsWith(prefix) ? file.slice(prefix.length) : file;
    const slash = relative.indexOf("/");
    if (slash === -1) {
      directFiles.push(file);
      continue;
    }
    const directory = `${prefix}${relative.slice(0, slash)}`;
    directoryCounts.set(directory, (directoryCounts.get(directory) ?? 0) + 1);
  }
  return {
    path: basePath,
    totalFiles,
    truncated: true,
    files: directFiles.slice(0, maxEntries),
    directories: [...directoryCounts.entries()]
      .map(([directory, count]) => ({ path: directory, files: count }))
      .sort((left, right) => right.files - left.files)
      .slice(0, maxEntries),
  };
}

export function buildSearchScript(params: {
  sha: string;
  query: string;
  regex: boolean;
  ignoreCase: boolean;
  path: string;
  glob?: string;
  maxPerFile: number;
}): string {
  if (params.query.trim().length === 0) {
    throw new Error("The search query cannot be empty.");
  }
  const flags = [
    "-n",
    "-I",
    "--no-color",
    `--max-count=${params.maxPerFile}`,
    params.regex ? "-E" : "-F",
    params.ignoreCase ? "-i" : "",
  ].filter(Boolean);
  // Only grep's exit status goes to a file, so it survives the line cap:
  // 1 means no match, anything above is an error such as an invalid regex.
  // 141 is SIGPIPE from head closing the pipe once the cap is reached.
  return [
    "s=$(mktemp)",
    "trap 'rm -f \"$s\"' EXIT INT TERM",
    `{ ${GIT} grep ${flags.join(" ")} -e ${shellQuote(params.query)} ${shellQuote(assertFullSha(params.sha))} -- ${pathspecFor(params.path, params.glob)} ${EXCLUDED_PATHSPECS}; echo "$?" > "$s"; } | head -n ${CODE_RESEARCH_SEARCH_MAX_LINES}`,
    'c=$(cat "$s")',
    '[ -z "$c" ] && c=2',
    '[ "$c" = 141 ] && c=0',
    'exit "$c"',
  ].join("; ");
}

export function parseSearchMatches(
  output: string,
  maxMatches: number,
  sha?: string
): {
  matches: CodeResearchSearchMatch[];
  truncated: boolean;
  hiddenPaths: number;
} {
  const matches: CodeResearchSearchMatch[] = [];
  let truncated = false;
  const hidden = new Set<string>();
  const commitPrefix = sha ? `${sha}:` : "";
  for (const rawLine of output.split("\n")) {
    const line = rawLine.startsWith(commitPrefix)
      ? rawLine.slice(commitPrefix.length)
      : rawLine;
    const parsed = SEARCH_LINE_PATTERN.exec(line);
    if (!parsed) {
      continue;
    }
    const [, path = "", lineNumber = "0", text = ""] = parsed;
    // A filename may itself contain ":<digits>:", so every possible split is
    // checked; any denied candidate path hides the line.
    if (hasDeniedCandidatePath(line)) {
      hidden.add(path);
      continue;
    }
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    const redacted = redactSecrets(text.trim());
    matches.push({
      path,
      line: Number.parseInt(lineNumber, 10),
      text:
        redacted.length > CODE_RESEARCH_LINE_MAX_CHARS
          ? `${redacted.slice(0, CODE_RESEARCH_LINE_MAX_CHARS)}…`
          : redacted,
    });
  }
  return { matches, truncated, hiddenPaths: hidden.size };
}

export function buildReadFileScript(
  sha: string,
  path: string,
  startLine: number,
  endLine: number
): string {
  const object = shellQuote(`${assertFullSha(sha)}:${path}`);
  // Symlinks are blobs holding their target path, so nothing outside the
  // repository can be reached through them.
  return [
    `t=$(${GIT} cat-file -t ${object} 2>/dev/null) || exit 3`,
    `[ "$t" = blob ] || exit 5`,
    `if [ "$(${GIT} cat-file -s ${object})" -gt 0 ] && ! ${GIT} show ${object} | grep -Iq .; then exit 6; fi`,
    `echo ${shellQuote(path)}`,
    `${GIT} show ${object} | wc -l`,
    `${GIT} show ${object} | sed -n ${shellQuote(`${startLine},${endLine}p`)} | head -c ${CODE_RESEARCH_READ_MAX_BYTES + 1}`,
  ].join("; ");
}

export function describeReadFailure(exitCode: number, path: string): string {
  switch (exitCode) {
    case 3:
      return `"${path}" does not exist. Use list_repository_files or search_repository to find the right path.`;
    case 5:
      return `"${path}" is a directory. Use list_repository_files instead.`;
    case 6:
      return `"${path}" is a binary file and cannot be read as text.`;
    default:
      return `Reading "${path}" failed with exit code ${exitCode}.`;
  }
}

export function parseReadFile(output: string) {
  const [resolved = "", totalLine = "0", ...content] = output.split("\n");
  return {
    resolvedPath: resolved,
    totalLines: Number.parseInt(totalLine.trim(), 10) || 0,
    content: content.join("\n"),
  };
}

export function buildHistoryScript(params: {
  sha: string;
  limit: number;
  path: string;
  since?: string;
  grep?: string;
}): string {
  const args = [
    `-n ${params.limit}`,
    `--format=${shellQuote(COMMIT_FORMAT)}`,
    params.since ? `--since=${shellQuote(params.since)}` : "",
    params.grep?.trim()
      ? `-i --fixed-strings --grep=${shellQuote(params.grep.trim())}`
      : "",
  ].filter(Boolean);
  const pathspec = params.path ? ` -- ${shellQuote(params.path)}` : "";
  return `${GIT} log ${args.join(" ")} ${shellQuote(assertFullSha(params.sha))}${pathspec}`;
}

export function buildShowChangeScript(params: {
  sha: string;
  ref: string | null;
  defaultBranch: string;
  path: string;
}): string {
  const pathspec = `${shellQuote(params.path || ".")} ${EXCLUDED_PATHSPECS}`;
  const limit = CODE_RESEARCH_DIFF_MAX_BYTES + 1;
  if (params.ref) {
    const ref = shellQuote(assertSafeRef(params.ref, "ref"));
    const fetchMissing = CODE_RESEARCH_FULL_SHA_PATTERN.test(params.ref)
      ? `{ ${GIT} cat-file -e ${shellQuote(`${params.ref}^{commit}`)} 2>/dev/null || ${fetchWithFallback(params.ref)}; } && `
      : "";
    return `${fetchMissing}${GIT} show --no-color --diff-merges=first-parent --stat=200 --format=${shellQuote(
      `${COMMIT_FORMAT}%n%b`
    )} ${ref} -- ${pathspec} && echo @@PATCH && ${GIT} show --no-color --diff-merges=first-parent --format= --patch ${ref} -- ${pathspec} | head -c ${limit}`;
  }

  const branch = assertSafeRef(params.defaultBranch, "branch");
  const base = shellQuote(`refs/remotes/origin/${branch}`);
  const head = shellQuote(assertFullSha(params.sha));
  const deepen = (depth: number) =>
    `${CREDENTIAL_FREE_GIT} fetch --quiet --no-tags --deepen=${depth} origin ${shellQuote(
      `+refs/heads/${branch}:refs/remotes/origin/${branch}`
    )} ${head}`;
  const mergeBase = `b=$(${GIT} merge-base ${base} ${head})`;
  const findBase = [
    mergeBase,
    ...CODE_RESEARCH_DEEPEN_STEPS.map(
      (depth) => `{ ${deepen(depth)} && ${mergeBase}; }`
    ),
  ].join(" || ");
  return `{ ${findBase}; } || exit 7; ${GIT} log -1 --format=${shellQuote(
    `${COMMIT_FORMAT}%n%b`
  )} ${head} && ${GIT} diff --no-color --stat=200 "$b" ${head} -- ${pathspec} && echo @@PATCH && ${GIT} diff --no-color "$b" ${head} -- ${pathspec} | head -c ${limit}`;
}

export function stripDeniedDiffFiles(patch: string): {
  patch: string;
  hiddenFiles: string[];
} {
  const hiddenFiles: string[] = [];
  const kept: string[] = [];
  let skipping = false;
  for (const line of patch.split("\n")) {
    const header = DIFF_FILE_HEADER_PATTERN.exec(line);
    if (header) {
      const paths = [header[1] ?? "", header[2] ?? ""];
      skipping = paths.some(isDeniedRepoPath);
      if (skipping) {
        hiddenFiles.push(paths.find(isDeniedRepoPath) ?? paths[1] ?? "");
      }
    }
    if (!skipping) {
      kept.push(line);
    }
  }
  return { patch: kept.join("\n"), hiddenFiles };
}

function statLinePaths(line: string): string[] {
  const match = STAT_LINE_PATTERN.exec(line);
  const raw = match?.[1]?.trim();
  if (!raw) {
    return [];
  }
  if (!raw.includes(" => ")) {
    return [raw];
  }
  // Renames appear as "old => new" or "dir/{old => new}/file".
  const before =
    raw.replace(RENAME_BRACES_PATTERN, "$1").split(" => ")[0] ?? raw;
  const after =
    raw.replace(RENAME_BRACES_PATTERN, "$2").split(" => ").at(-1) ?? raw;
  return [before, after];
}

function stripDeniedStatLines(summary: string): string {
  return summary
    .split("\n")
    .filter((line) => !statLinePaths(line).some(isDeniedRepoPath))
    .join("\n");
}

export function parseShowChange(output: string) {
  const patchIndex = output.indexOf("\n@@PATCH\n");
  const header = patchIndex === -1 ? output : output.slice(0, patchIndex);
  const rawPatch = patchIndex === -1 ? "" : output.slice(patchIndex + 9);
  const [commitLine = "", ...rest] = header.split("\n");
  const commit = parseCommitLines(commitLine)[0] ?? null;
  const { patch, hiddenFiles } = stripDeniedDiffFiles(rawPatch);
  const truncatedPatch = truncateText(
    redactSecrets(patch),
    CODE_RESEARCH_DIFF_MAX_BYTES
  );
  return {
    commit,
    summary: redactSecrets(stripDeniedStatLines(rest.join("\n").trim())),
    patch: truncatedPatch.text,
    patchTruncated:
      truncatedPatch.truncated ||
      Buffer.byteLength(rawPatch, "utf8") > CODE_RESEARCH_DIFF_MAX_BYTES,
    hiddenFiles,
  };
}
