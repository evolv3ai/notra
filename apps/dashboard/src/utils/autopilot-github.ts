import { GITHUB_MENTION_TRUSTED_AUTHOR_ASSOCIATIONS } from "@notra/ai/constants/github-mention";
import { getGitHubMentionAppHandles } from "@notra/ai/utils/github-mention";

import {
  AUTOPILOT_COMMIT_FINGERPRINT,
  AUTOPILOT_COMMITS_FEATURE_TITLE,
  AUTOPILOT_COMMITS_MINOR_TITLE,
  AUTOPILOT_COMMITS_SKIP_TITLE,
  AUTOPILOT_MAX_REVIEWERS,
} from "@/constants/autopilot";
import type {
  MergedPullRequest,
  AutopilotPullRequestEvent,
} from "@/types/autopilot";
import type {
  AutopilotPullRequestAuthor,
  AutopilotPullRequestSummary,
  AutopilotPullRequestMoment,
} from "@/types/autopilot-runtime";

export function commitFingerprint(
  pull: Pick<MergedPullRequest, "repository" | "number">
) {
  return `commits:${pull.repository}#${pull.number}`;
}

/** The pull request a post about shipped work is about, or null for other findings. */
export function parseCommitFingerprint(fingerprint: string) {
  const match = AUTOPILOT_COMMIT_FINGERPRINT.exec(fingerprint);
  if (!match) {
    return null;
  }
  const [, owner = "", repo = "", number] = match;
  return { owner, repo, pullNumber: Number(number) };
}

const WHITESPACE = /\s+/g;
const INLINE_WHITESPACE = /[^\S\n]+/g;
const BLANK_LINES = /\s*\n\s*\n\s*/g;

export function describePullRequest(pull: MergedPullRequest) {
  return `${pull.repository}#${pull.number} ${pull.title}: ${pull.body.replace(WHITESPACE, " ")}`;
}

export function pullRequestLabel(pull: MergedPullRequest) {
  return `${pull.repository}#${pull.number} ${pull.title}`;
}

/**
 * Autopilot's own drafts and anything Notra's app opened: never a release.
 * Other bots are skipped only through the workspace's author list.
 */
export function isNotraPullRequest(pull: AutopilotPullRequestAuthor) {
  const login = pull.login?.toLowerCase();
  return (
    pull.headRef.startsWith("notra/") ||
    getGitHubMentionAppHandles().some((handle) => login === `${handle}[bot]`)
  );
}

/** A GitHub App's login ends in [bot] even where the payload omits its type. */
export function isBotAuthor(user: { type?: string | null; login: string }) {
  return user.type === "Bot" || user.login.toLowerCase().endsWith("[bot]");
}

export function isPostCandidateTitle(title: string) {
  return !AUTOPILOT_COMMITS_SKIP_TITLE.test(title);
}

/** Lower ranks first: features, then fixes and unprefixed titles, then refactors and docs. */
export function pullRequestTitleRank(title: string) {
  if (AUTOPILOT_COMMITS_FEATURE_TITLE.test(title)) {
    return 0;
  }
  return AUTOPILOT_COMMITS_MINOR_TITLE.test(title) ? 2 : 1;
}

/** Unknown or public source visibility must not reveal a private destination. */
export function describeAutopilotDraftLocation(
  url: string,
  sourceIsPrivate: boolean
) {
  return sourceIsPrivate
    ? `: ${url}`
    : ". You can review it in Notra Autopilot.";
}

/** Shared cheap admission for the webhook enqueue and the durable worker. */
export function autopilotPullRequestMoment(
  event: AutopilotPullRequestEvent
): AutopilotPullRequestMoment | null {
  const pr = event.pull_request;
  if (
    !GITHUB_MENTION_TRUSTED_AUTHOR_ASSOCIATIONS.some(
      (association) => association === pr.author_association
    ) ||
    isNotraPullRequest({
      headRef: pr.head.ref,
      login: pr.user?.login ?? null,
    })
  ) {
    return null;
  }
  if (
    event.action === "ready_for_review" ||
    (event.action === "opened" && !pr.draft)
  ) {
    return "ready";
  }
  if (event.action === "closed") {
    return pr.merged ? "merged" : "closed";
  }
  return null;
}

export function toMergedPullRequest(
  repository: string,
  pull: AutopilotPullRequestSummary
): MergedPullRequest {
  return {
    repository,
    number: pull.number,
    title: pull.title,
    url: pull.url,
    // Line breaks stay so the idea page can show headings and lists.
    body: (pull.body ?? "")
      .replace(INLINE_WHITESPACE, " ")
      .replace(BLANK_LINES, "\n\n")
      .trim()
      .slice(0, 600),
    author: pull.author,
  };
}

/**
 * Who reviews a draft: the people whose pull requests it is about. Bots never
 * do, and that includes Notra's app, which opens every draft.
 */
export function autopilotReviewers(
  pullRequests: { author?: string | null }[] | undefined
) {
  const logins = (pullRequests ?? []).flatMap((pull) =>
    pull.author && !pull.author.endsWith("[bot]") ? [pull.author] : []
  );
  return [...new Set(logins)].slice(0, AUTOPILOT_MAX_REVIEWERS);
}
