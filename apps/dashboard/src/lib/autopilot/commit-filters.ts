import type { AutopilotCommitFilters } from "@notra/db/types/autopilot";

import { AUTOPILOT_PULL_REQUEST_FILES_MAX_PAGES } from "@/constants/autopilot";
import type { AutopilotRepository } from "@/types/autopilot";
import type { AutopilotOctokit } from "@/types/autopilot-runtime";
import {
  excludedAuthorReason,
  matchesAnyRepositoryPath,
  outsidePathsReason,
  repositoryPathFilter,
} from "@/utils/autopilot-commit-filters";

/**
 * Whether a pull request changes a file under one of the patterns, renames
 * included. Reads at most a few pages and stops at the first match; a pull
 * request too big to read fully without a match counts as a match.
 */
async function pullRequestTouchesPaths(
  octokit: AutopilotOctokit,
  repository: Pick<AutopilotRepository, "owner" | "name">,
  pullNumber: number,
  patterns: string[]
) {
  const perPage = 100;
  for (let page = 1; page <= AUTOPILOT_PULL_REQUEST_FILES_MAX_PAGES; page++) {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner: repository.owner,
        repo: repository.name,
        pull_number: pullNumber,
        per_page: perPage,
        page,
      }
    );
    const paths = data.flatMap((file) =>
      file.previous_filename
        ? [file.filename, file.previous_filename]
        : [file.filename]
    );
    if (matchesAnyRepositoryPath(paths, patterns)) {
      return true;
    }
    if (data.length < perPage) {
      return false;
    }
  }
  return true;
}

/**
 * Why a pull request stays out of "Write about releases", or null when it
 * counts. The author check costs nothing; changed files are read only when the
 * repository has a path filter. Runs before Jev, so a filtered pull request
 * never costs a model call. `@notra` mentions skip this: an explicit ask wins.
 */
export async function commitFilterSkipReason(params: {
  filters: AutopilotCommitFilters;
  repository: { owner: string; name: string; fullName: string };
  pull: { number: number; author: string | null };
  getOctokit: () => Promise<AutopilotOctokit | null>;
}) {
  const { filters, repository, pull } = params;
  const author = excludedAuthorReason(filters, pull.author);
  if (author) {
    return author;
  }
  const patterns = repositoryPathFilter(filters, repository.fullName);
  if (!patterns) {
    return null;
  }
  try {
    const octokit = await params.getOctokit();
    if (!octokit) {
      return null;
    }
    const touches = await pullRequestTouchesPaths(
      octokit,
      repository,
      pull.number,
      patterns
    );
    return touches ? null : outsidePathsReason(patterns);
  } catch {
    // Unreadable files are no reason to drop a release; Jev still decides.
    return null;
  }
}
