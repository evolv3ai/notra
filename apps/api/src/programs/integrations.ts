import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { getTokenForIntegrationId } from "@notra/ai/integrations/github";
import { createOctokit } from "@notra/ai/utils/octokit";
import {
  githubIntegrations,
  linearIntegrations,
  repositoryOutputs,
} from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { and, asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  GITHUB_ACTIVITY_DEFAULT_LOOKBACK_MS,
  GITHUB_ACTIVITY_PER_PAGE,
} from "../constants/github-activity";
import {
  GitHubAccessError,
  IntegrationCreateError,
  IntegrationCreateFailedError,
  IntegrationDatabaseError,
  IntegrationDuplicateError,
  IntegrationNotFoundError,
  IntegrationUnavailableError,
} from "../errors/integrations";
import type { DbClient } from "../types/db";
import type {
  AssertNoGitHubIntegrationDuplicateInput,
  CreateGitHubIntegrationProgramInput,
  CreateGitHubIntegrationProgramSuccess,
  DeleteIntegrationProgramInput,
  DeleteIntegrationProgramSuccess,
  GetGitHubActivityProgramInput,
  GetGitHubActivityProgramSuccess,
  ListIntegrationsProgramInput,
  ListIntegrationsProgramSuccess,
} from "../types/integrations";
import {
  encryptGitHubIntegrationSecret,
  findGitHubIntegrationCreatorUserId,
  findMatchingGitHubIntegration,
  generateGitHubIntegrationId,
  generateGitHubWebhookSecret,
  validateGitHubRepositoryAccess,
} from "../utils/github-integrations";
import {
  deleteQstashSchedulesForTriggers,
  disableTriggersAndDelete,
  getTriggersForIntegration,
  serializeDisabledTriggers,
} from "../utils/triggers";

type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const database = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => new IntegrationDatabaseError({ cause }),
  });

const write = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => {
      if (isPgUniqueViolation(cause)) {
        return new IntegrationDuplicateError();
      }

      return new IntegrationCreateError({ cause });
    },
  });

export const listIntegrations = Effect.fn("integrations.list")(function* ({
  db,
  organizationId,
}: ListIntegrationsProgramInput) {
  const [github, linear] = yield* database(() =>
    Promise.all([
      db.query.githubIntegrations.findMany({
        where: and(
          eq(githubIntegrations.organizationId, organizationId),
          eq(githubIntegrations.enabled, true)
        ),
        orderBy: [
          asc(githubIntegrations.displayName),
          asc(githubIntegrations.id),
        ],
        columns: {
          id: true,
          displayName: true,
          owner: true,
          repo: true,
          defaultBranch: true,
        },
      }),
      db.query.linearIntegrations.findMany({
        where: and(
          eq(linearIntegrations.organizationId, organizationId),
          eq(linearIntegrations.enabled, true)
        ),
        orderBy: [
          asc(linearIntegrations.displayName),
          asc(linearIntegrations.id),
        ],
        columns: {
          id: true,
          displayName: true,
          linearOrganizationId: true,
          linearOrganizationName: true,
          linearTeamId: true,
          linearTeamName: true,
        },
      }),
    ])
  );

  return {
    github,
    linear,
  } satisfies ListIntegrationsProgramSuccess;
});

export const assertNoGitHubIntegrationDuplicate = Effect.fn(
  "integrations.assertNoGitHubDuplicate"
)(function* ({
  db,
  organizationId,
  owner,
  repo,
}: AssertNoGitHubIntegrationDuplicateInput) {
  const existingIntegration = yield* database(() =>
    findMatchingGitHubIntegration(db, organizationId, owner, repo)
  );

  if (existingIntegration) {
    return yield* new IntegrationDuplicateError();
  }
});

export const createGitHubIntegration = Effect.fn("integrations.createGitHub")(
  function* (input: CreateGitHubIntegrationProgramInput) {
    const owner = input.body.owner.trim();
    const repo = input.body.repo.trim();
    const branch = input.body.branch?.trim() || null;
    const token = input.body.token?.trim() || null;

    yield* validateGitHubRepositoryAccess({ owner, repo, token });

    const integrationId = generateGitHubIntegrationId();
    const createdByUserId = yield* database(() =>
      findGitHubIntegrationCreatorUserId(input.db, input.organizationId)
    );
    if (!createdByUserId) {
      return yield* new GitHubAccessError({
        message: "Organization has no members available to own the integration",
      });
    }
    const encryptedToken = token
      ? yield* encryptGitHubIntegrationSecret(token, input.runtimeEnv)
      : null;
    const encryptedWebhookSecret = yield* encryptGitHubIntegrationSecret(
      generateGitHubWebhookSecret(),
      input.runtimeEnv
    );

    const integration = yield* write(() =>
      input.db.transaction(async (tx) => {
        const [createdIntegration] = await tx
          .insert(githubIntegrations)
          .values({
            id: integrationId,
            organizationId: input.organizationId,
            createdByUserId,
            encryptedToken,
            displayName: `${owner}/${repo}`,
            owner,
            repo,
            defaultBranch: branch,
            repositoryEnabled: true,
            encryptedWebhookSecret,
            enabled: true,
          })
          .returning({
            id: githubIntegrations.id,
            displayName: githubIntegrations.displayName,
            owner: githubIntegrations.owner,
            repo: githubIntegrations.repo,
            defaultBranch: githubIntegrations.defaultBranch,
          });

        if (!createdIntegration) {
          return undefined;
        }

        await tx.insert(repositoryOutputs).values([
          {
            id: generateGitHubIntegrationId(),
            repositoryId: integrationId,
            outputType: "changelog",
            enabled: true,
            config: null,
          },
          {
            id: generateGitHubIntegrationId(),
            repositoryId: integrationId,
            outputType: "blog_post",
            enabled: false,
            config: null,
          },
          {
            id: generateGitHubIntegrationId(),
            repositoryId: integrationId,
            outputType: "twitter_post",
            enabled: false,
            config: null,
          },
        ]);

        return createdIntegration;
      })
    );

    if (!integration) {
      return yield* new IntegrationCreateFailedError();
    }

    return integration satisfies CreateGitHubIntegrationProgramSuccess;
  }
);

const deleteIntegrationWithTriggerCleanup = Effect.fnUntraced(function* (
  input: DeleteIntegrationProgramInput,
  deleteIntegrationRecord: (tx: DbTransaction) => Promise<unknown>
) {
  const affectedTriggers = yield* database(() =>
    getTriggersForIntegration(
      input.db,
      input.organizationId,
      input.integrationId
    )
  );

  yield* database(() =>
    disableTriggersAndDelete(
      input.db,
      input.organizationId,
      affectedTriggers,
      deleteIntegrationRecord
    )
  );

  yield* database(() =>
    deleteQstashSchedulesForTriggers(input.runtimeEnv, affectedTriggers)
  );

  return {
    id: input.integrationId,
    ...serializeDisabledTriggers(affectedTriggers),
  } satisfies DeleteIntegrationProgramSuccess;
});

export const deleteIntegration = Effect.fn("integrations.delete")(function* ({
  db,
  organizationId,
  integrationId,
  runtimeEnv,
}: DeleteIntegrationProgramInput) {
  const githubIntegration = yield* database(() =>
    db.query.githubIntegrations.findFirst({
      where: and(
        eq(githubIntegrations.id, integrationId),
        eq(githubIntegrations.organizationId, organizationId)
      ),
      columns: {
        id: true,
      },
    })
  );

  if (githubIntegration) {
    return yield* deleteIntegrationWithTriggerCleanup(
      { db, organizationId, integrationId, runtimeEnv },
      (tx) =>
        tx
          .delete(githubIntegrations)
          .where(
            and(
              eq(githubIntegrations.id, integrationId),
              eq(githubIntegrations.organizationId, organizationId)
            )
          )
    );
  }

  const [existingLinearIntegration] = yield* database(() =>
    db
      .select({ id: linearIntegrations.id })
      .from(linearIntegrations)
      .where(
        and(
          eq(linearIntegrations.id, integrationId),
          eq(linearIntegrations.organizationId, organizationId)
        )
      )
      .limit(1)
  );

  if (!existingLinearIntegration) {
    return yield* new IntegrationNotFoundError();
  }

  return yield* deleteIntegrationWithTriggerCleanup(
    { db, organizationId, integrationId, runtimeEnv },
    (tx) =>
      tx
        .delete(linearIntegrations)
        .where(
          and(
            eq(linearIntegrations.id, integrationId),
            eq(linearIntegrations.organizationId, organizationId)
          )
        )
  );
});

const githubRead = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => {
      const status =
        typeof cause === "object" && cause !== null && "status" in cause
          ? cause.status
          : undefined;
      const headers =
        typeof cause === "object" && cause !== null && "response" in cause
          ? (cause.response as { headers?: Record<string, string> } | undefined)
              ?.headers
          : undefined;
      const message = cause instanceof Error ? cause.message : "";
      const rateLimited =
        status === 429 ||
        (status === 403 &&
          (headers?.["x-ratelimit-remaining"] === "0" ||
            headers?.["retry-after"] !== undefined ||
            /rate limit/i.test(message)));
      if (
        status === 401 ||
        status === 404 ||
        (status === 403 && !rateLimited)
      ) {
        return new GitHubAccessError({
          message:
            "Notra can no longer read this repository. Reconnect the integration in the dashboard.",
        });
      }
      return new IntegrationUnavailableError({ cause });
    },
  });

const splitCommitMessage = (message: string) => {
  const [title = "", ...rest] = message.split("\n");
  return { title, body: rest.join("\n").trim() || null };
};

export const getGitHubActivity = Effect.fn("integrations.githubActivity")(
  function* ({
    db,
    organizationId,
    integrationId,
    query,
  }: GetGitHubActivityProgramInput) {
    const integration = yield* database(() =>
      db.query.githubIntegrations.findFirst({
        where: and(
          eq(githubIntegrations.id, integrationId),
          eq(githubIntegrations.organizationId, organizationId),
          eq(githubIntegrations.enabled, true),
          eq(githubIntegrations.repositoryEnabled, true)
        ),
        columns: {
          id: true,
          displayName: true,
          owner: true,
          repo: true,
          defaultBranch: true,
        },
      })
    );
    const owner = integration?.owner?.trim();
    const repo = integration?.repo?.trim();
    if (!(integration && owner && repo)) {
      return yield* new IntegrationNotFoundError();
    }

    const until = query.until ?? new Date().toISOString();
    const since =
      query.since ??
      new Date(
        Date.parse(until) - GITHUB_ACTIVITY_DEFAULT_LOOKBACK_MS
      ).toISOString();
    const sinceMs = Date.parse(since);
    const untilMs = Date.parse(until);
    const inWindow = (date: string | null | undefined) => {
      const ms = date ? Date.parse(date) : Number.NaN;
      return ms >= sinceMs && ms <= untilMs;
    };

    const token = yield* githubRead(() =>
      getTokenForIntegrationId(integration.id, { organizationId })
    );
    const octokit = createOctokit(token ?? undefined);
    const page = query.page;
    const common = {
      owner,
      repo,
      page,
      per_page: GITHUB_ACTIVITY_PER_PAGE,
      headers: GITHUB_API_VERSION_HEADERS,
    };
    const branch =
      integration.defaultBranch ??
      (yield* githubRead(() =>
        octokit.request("GET /repos/{owner}/{repo}", {
          owner,
          repo,
          headers: GITHUB_API_VERSION_HEADERS,
        })
      )).data.default_branch;
    const hasNext = (link: string | undefined) =>
      link?.includes('rel="next"') ?? false;

    let items: GetGitHubActivityProgramSuccess["items"];
    let more: boolean;

    if (query.type === "commits") {
      const response = yield* githubRead(() =>
        octokit.request("GET /repos/{owner}/{repo}/commits", {
          ...common,
          since,
          until,
          sha: branch,
        })
      );
      items = response.data.map((commit) => ({
        ref: commit.sha,
        ...splitCommitMessage(commit.commit.message),
        author: commit.author?.login ?? commit.commit.author?.name ?? null,
        url: commit.html_url,
        occurredAt:
          commit.commit.committer?.date ?? commit.commit.author?.date ?? until,
      }));
      more = hasNext(response.headers.link);
    } else if (query.type === "releases") {
      const response = yield* githubRead(() =>
        octokit.request("GET /repos/{owner}/{repo}/releases", common)
      );
      items = response.data
        .filter((release) => inWindow(release.published_at))
        .map((release) => ({
          ref: release.tag_name,
          title: release.name || release.tag_name,
          body: release.body ?? null,
          author: release.author?.login ?? null,
          url: release.html_url,
          occurredAt: release.published_at ?? release.created_at,
        }));
      more = hasNext(response.headers.link);
    } else {
      const response = yield* githubRead(() =>
        octokit.request("GET /repos/{owner}/{repo}/pulls", {
          ...common,
          state: "closed",
          sort: "updated",
          direction: "desc",
          base: branch,
        })
      );
      items = response.data
        .filter((pull) => inWindow(pull.merged_at))
        .map((pull) => ({
          ref: String(pull.number),
          title: pull.title,
          body: pull.body ?? null,
          author: pull.user?.login ?? null,
          url: pull.html_url,
          occurredAt: pull.merged_at ?? pull.updated_at,
        }));
      const oldest = response.data.at(-1)?.updated_at;
      more =
        hasNext(response.headers.link) &&
        oldest !== undefined &&
        Date.parse(oldest) >= sinceMs;
    }

    return {
      integration: {
        id: integration.id,
        displayName: integration.displayName,
        owner,
        repo,
        defaultBranch: integration.defaultBranch,
      },
      type: query.type,
      since,
      until,
      items,
      pagination: { page, nextPage: more ? page + 1 : null },
    } satisfies GetGitHubActivityProgramSuccess;
  }
);
