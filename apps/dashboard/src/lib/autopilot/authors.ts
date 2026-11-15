import { listGitHubAppRepositoriesEffect } from "@notra/ai/integrations/github";
import { redis } from "@notra/ai/utils/redis";
import { Effect } from "effect";

import {
  AUTOPILOT_AUTHOR_SUGGESTION_CACHE_SECONDS,
  AUTOPILOT_AUTHOR_SUGGESTION_DAYS,
  AUTOPILOT_AUTHOR_SUGGESTION_MAX,
  AUTOPILOT_COMMITS_MAX_REPOSITORIES,
} from "@/constants/autopilot";
import { getInstallationOctokit } from "@/lib/autopilot/github";
import type { AutopilotAuthorSuggestion } from "@/types/autopilot";
import {
  isBotAuthor,
  isNotraPullRequest,
  isPostCandidateTitle,
} from "@/utils/autopilot-github";

function cacheKey(organizationId: string) {
  return `autopilot:authors:v2:${organizationId}`;
}

async function readAuthors(organizationId: string) {
  const repositories = await Effect.runPromise(
    listGitHubAppRepositoriesEffect(organizationId)
  ).catch(() => []);
  // The repositories the daily job reads; one list call each.
  const selected = repositories.slice(0, AUTOPILOT_COMMITS_MAX_REPOSITORIES);
  const owners = [...new Set(selected.map((repository) => repository.owner))];
  const octokits = new Map(
    await Promise.all(
      owners.map(
        async (owner) =>
          [
            owner,
            await getInstallationOctokit(organizationId, owner).catch(
              () => null
            ),
          ] as const
      )
    )
  );
  const since =
    Date.now() - AUTOPILOT_AUTHOR_SUGGESTION_DAYS * 24 * 60 * 60 * 1000;
  const lists = await Promise.allSettled(
    selected.map(async (repository) => {
      const octokit = octokits.get(repository.owner);
      if (!octokit) {
        return [];
      }
      const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls",
        {
          owner: repository.owner,
          repo: repository.name,
          state: "closed",
          sort: "updated",
          direction: "desc",
          per_page: 100,
        }
      );
      return data.filter(
        (pull) =>
          pull.merged_at &&
          new Date(pull.merged_at).getTime() >= since &&
          pull.user?.login &&
          !isNotraPullRequest({
            headRef: pull.head.ref,
            login: pull.user.login,
          })
      );
    })
  );
  const authors = new Map<string, AutopilotAuthorSuggestion>();
  for (const list of lists) {
    for (const pull of list.status === "fulfilled" ? list.value : []) {
      const user = pull.user ?? { login: "", type: "User" };
      const login = user.login.toLowerCase();
      const author = authors.get(login) ?? {
        login,
        bot: isBotAuthor(user),
        pullRequests: 0,
        chores: 0,
      };
      author.pullRequests += 1;
      author.chores += isPostCandidateTitle(pull.title) ? 0 : 1;
      authors.set(login, author);
    }
  }
  return [...authors.values()]
    .sort((a, b) => b.pullRequests - a.pullRequests)
    .slice(0, AUTOPILOT_AUTHOR_SUGGESTION_MAX);
}

/**
 * Who merged pull requests in the watched repositories lately, for the skip
 * list: at most one GitHub call per repository, cached for an hour. Empty when
 * GitHub isn't connected.
 */
export async function listRecentPullRequestAuthors(
  organizationId: string
): Promise<AutopilotAuthorSuggestion[]> {
  const cached = redis
    ? await redis
        .get<AutopilotAuthorSuggestion[]>(cacheKey(organizationId))
        .catch(() => null)
    : null;
  if (Array.isArray(cached)) {
    return cached;
  }
  const authors = await readAuthors(organizationId);
  await redis
    ?.set(cacheKey(organizationId), JSON.stringify(authors), {
      ex: AUTOPILOT_AUTHOR_SUGGESTION_CACHE_SECONDS,
    })
    .catch(() => undefined);
  return authors;
}
