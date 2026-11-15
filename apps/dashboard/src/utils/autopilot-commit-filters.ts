import type { AutopilotCommitFilters } from "@notra/db/types/autopilot";

import {
  AUTOPILOT_AUTHOR_PRESETS_SHOWN,
  AUTOPILOT_CHORE_AUTHOR_MIN_PULL_REQUESTS,
  AUTOPILOT_CHORE_AUTHOR_MIN_SHARE,
  AUTOPILOT_DEFAULT_COMMIT_FILTERS,
  AUTOPILOT_WELL_KNOWN_BOTS,
} from "@/constants/autopilot";
import type { AutopilotAuthorSuggestion } from "@/types/autopilot";

const GLOB_CHARACTERS = /[*?]/;

/** Saved filters with the defaults filled in, for rows written before them. */
export function toAutopilotCommitFilters(
  saved: Partial<AutopilotCommitFilters> | null | undefined
): AutopilotCommitFilters {
  return { ...AUTOPILOT_DEFAULT_COMMIT_FILTERS, ...saved };
}

/** Why a pull request's author keeps it out, or null when it may count. */
export function excludedAuthorReason(
  filters: AutopilotCommitFilters,
  author: string | null
) {
  return author && filters.excludedAuthors.includes(author.toLowerCase())
    ? `author ${author} is excluded`
    : null;
}

/** The path filter of one repository, or null when every change counts. */
export function repositoryPathFilter(
  filters: AutopilotCommitFilters,
  fullName: string
) {
  const patterns = filters.paths[fullName.toLowerCase()];
  return patterns && patterns.length > 0 ? patterns : null;
}

/**
 * Glob match in O(pattern × path): one boolean row per token instead of a
 * backtracking regex, so repeated wildcards can't blow up on long paths.
 * ** followed by / is an optional run of folders, ** alone is anything,
 * * stays inside one folder and ? is one character other than /.
 */
function matchesGlob(path: string, pattern: string) {
  let reachable = new Array<boolean>(path.length + 1).fill(false);
  reachable[0] = true;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index] ?? "";
    const next = new Array<boolean>(path.length + 1).fill(false);
    if (character === "*" && pattern[index + 1] === "*") {
      const slash = pattern[index + 2] === "/";
      let seen = false;
      for (let position = 0; position <= path.length; position++) {
        const atFolder = !slash || path[position - 1] === "/";
        next[position] = (reachable[position] ?? false) || (seen && atFolder);
        seen ||= reachable[position] ?? false;
      }
      index += slash ? 2 : 1;
    } else if (character === "*") {
      for (let position = 0; position <= path.length; position++) {
        next[position] =
          (reachable[position] ?? false) ||
          (position > 0 &&
            (next[position - 1] ?? false) &&
            path[position - 1] !== "/");
      }
    } else {
      for (let position = 0; position < path.length; position++) {
        const pathCharacter = path[position];
        next[position + 1] =
          (reachable[position] ?? false) &&
          (character === "?"
            ? pathCharacter !== "/"
            : pathCharacter === character);
      }
    }
    reachable = next;
  }
  return reachable[path.length] ?? false;
}

/**
 * A plain path is a prefix ("apps/web" covers everything under it); with * or
 * ? it is a glob where * stays inside one folder and ** crosses folders.
 */
function matchesRepositoryPath(path: string, pattern: string) {
  const clean = pattern.replace(/^\.?\/+/, "").replace(/\/+$/, "");
  if (!clean) {
    return true;
  }
  if (!GLOB_CHARACTERS.test(clean)) {
    return path === clean || path.startsWith(`${clean}/`);
  }
  return matchesGlob(path, clean);
}

export function matchesAnyRepositoryPath(paths: string[], patterns: string[]) {
  return paths.some((path) =>
    patterns.some((pattern) => matchesRepositoryPath(path, pattern))
  );
}

export function outsidePathsReason(patterns: string[]) {
  return `no changed files under ${patterns.join(", ")}`;
}

/**
 * One-click authors to skip: the bots seen in your repositories (or the
 * well-known ones when there are none), then people whose pull requests are
 * mostly chores. Added ones drop out.
 */
export function autopilotAuthorPresets(
  authors: AutopilotAuthorSuggestion[],
  excluded: string[]
) {
  const repositoryBots = authors
    .filter((author) => author.bot)
    .map((author) => author.login);
  const choreAuthors = authors
    .filter(
      (author) =>
        !author.bot &&
        author.pullRequests >= AUTOPILOT_CHORE_AUTHOR_MIN_PULL_REQUESTS &&
        author.chores / author.pullRequests >= AUTOPILOT_CHORE_AUTHOR_MIN_SHARE
    )
    .map((author) => author.login);
  const bots =
    repositoryBots.length > 0 ? repositoryBots : AUTOPILOT_WELL_KNOWN_BOTS;
  const listed = new Set(excluded);
  return [...new Set([...bots, ...choreAuthors])]
    .filter((login) => !listed.has(login))
    .slice(0, AUTOPILOT_AUTHOR_PRESETS_SHOWN);
}
