import { invalidateStandaloneChatIntegrations } from "@notra/ai/chat/integrations-cache";
import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { MCP_OAUTH_CALLBACK_PATH } from "@notra/ai/constants/mcp-auth";
import {
  addRepository,
  configureOutput,
  createGitHubIntegration,
  deleteGitHubIntegration,
  deleteRepository,
  findConflictingRepositoryInOrganization,
  GitHubBranchNotFoundError,
  GitHubRepositoryNotFoundError,
  generateWebhookSecretForRepository,
  getGitHubIntegrationById,
  getOutputById,
  getRepositoryById,
  getTokenForIntegrationId,
  getWebhookConfigForRepository,
  listAvailableRepositories,
  repairWebhookForRepository,
  setRepositoryOutputConfig,
  toggleOutput,
  updateGitHubIntegration,
  updateGitHubIntegrationToken,
  updateRepository,
  validateRepositoryAccess,
  validateRepositoryBranchExists,
} from "@notra/ai/integrations/github";
import {
  createGranolaIntegration,
  deleteGranolaIntegration,
  getGranolaIntegrationById,
  getGranolaIntegrationsByOrganization,
  updateGranolaIntegration,
  verifyGranolaApiKey,
} from "@notra/ai/integrations/granola";
import {
  deleteLinearIntegration,
  getLinearIntegrationById,
  getLinearIntegrationsByOrganization,
  updateLinearIntegration,
} from "@notra/ai/integrations/linear";
import {
  createMcpConnectionIntegration,
  deleteMcpConnectionIntegration,
  getMcpConnectionIntegration,
  getMcpConnectionIntegrationsByOrganization,
  serializeMcpServerIntegration,
  testMcpServerConnection,
  updateMcpConnectionIntegration,
} from "@notra/ai/integrations/mcp";
import { beginMcpOAuthAuthorization } from "@notra/ai/integrations/mcp-oauth";
import {
  McpOAuthAuthorizationError,
  McpOAuthNameConflictError,
} from "@notra/ai/integrations/mcp-oauth-errors";
import {
  getLiveMcpStoreIntegrationById,
  listLiveMcpStoreIntegrations,
} from "@notra/ai/integrations/mcp-store";
import { McpStoreListingUnavailableError } from "@notra/ai/integrations/mcp-store-errors";
import { refreshMcpToolIndexForIntegration } from "@notra/ai/integrations/mcp-tool-index";
import {
  deleteSlackIntegration,
  getSlackIntegrationBotToken,
  getSlackIntegrationById,
  getSlackIntegrationsByOrganization,
  updateSlackIntegration,
} from "@notra/ai/integrations/slack-workspace";
import { deleteQstashSchedule } from "@notra/ai/qstash/triggers";
import {
  GitHubInstallationMissingError,
  GitHubMultiRepositoryUnsupportedError,
  GitHubRepositoryAlreadyConnectedError,
  GitHubWebhookRepairPreconditionError,
} from "@notra/ai/schemas/github-operations";
import type { GitHubConnectionMethod } from "@notra/ai/types/github-connection";
import {
  createOctokit,
  GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
} from "@notra/ai/utils/octokit";
import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import {
  posts,
  githubIntegrations,
  contentTriggers,
  repositoryOutputs,
} from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import {
  createGranolaIntegrationRequestSchema,
  updateGranolaIntegrationBodySchema,
} from "@notra/schemas/dashboard/granola";
import {
  addRepositoryRequestSchema,
  beginMcpOAuthRequestSchema,
  configureOutputBodySchema,
  createRepositoryBranchBodySchema,
  createGitHubIntegrationRequestSchema,
  createMcpServerRequestSchema,
  type IntegrationType,
  integrationIdParamSchema,
  integrationInputSchema,
  listRepositoryDirectoriesInputSchema,
  mcpServerIdParamSchema,
  mcpServerInputSchema,
  outputIdParamSchema,
  outputInputSchema,
  reauthorizeMcpOAuthRequestSchema,
  repositoryContentDirectoryConfigSchema,
  repositoryContentDirectoryInputSchema,
  repositoryIdParamSchema,
  repositoryInputSchema,
  testMcpServerRequestSchema,
  triggerTargetsSchema,
  updateIntegrationBodySchema,
  updateMcpServerBodySchema,
  updateOutputBodySchema,
  updateRepositoryBodySchema,
  updateRepositoryContentDirectoryBodySchema,
} from "@notra/schemas/dashboard/integrations";
import { updateLinearIntegrationBodySchema } from "@notra/schemas/dashboard/linear";
import {
  slackChannelListResponseSchema,
  slackCreateChannelBodySchema,
  slackListChannelsOptionsSchema,
  updateSlackIntegrationBodySchema,
} from "@notra/schemas/dashboard/slack-integration";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { isDemoMode } from "@notra/utils/demo-mode";
import { PublicUrlValidationError } from "@notra/utils/url";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

import { REPOSITORY_ALREADY_CONNECTED_CODE } from "@/constants/github";
import {
  INTEGRATION_AUTH_KINDS,
  INTEGRATION_PROVIDERS,
  MCP_CONNECTION_TEST_OUTCOMES,
  SLACK_CHANNEL_KINDS,
} from "@/constants/integration-analytics";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { getTranslations } from "@/lib/i18n/server";
import { toMcpIntegrationAuthKind } from "@/lib/integrations/auth-kind";
import { clearGitHubPublishFailures } from "@/lib/integrations/github/github-publish-failure-state";
import {
  findSiteGitHubPublishTarget,
  listSiteGitHubPublishTargets,
} from "@/lib/integrations/github/site-publish-target";
import {
  clearCachedSlackChannels,
  getCachedSlackChannels,
  setCachedSlackChannels,
} from "@/lib/integrations/slack/channel-cache";
import { createSlackChannel } from "@/lib/integrations/slack/create-channel";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { getIntegrationsByOrganization } from "@/lib/services/integrations";
import type {
  GitHubIntegration,
  GitHubRepository,
  RepositoryOutput,
} from "@/types/integrations";
import type { SlackChannelOption } from "@/types/slack-integration";
import { hasGitHubStatus } from "@/utils/github-publish-failure";
import { ratelimit } from "@/utils/ratelimit";

import {
  assertNotDemo,
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  tooManyRequests,
} from "../utils/errors";

async function assertMcpConnectionRateLimit(organizationId: string) {
  const { success } = await ratelimit.mcpConnection.limit(organizationId);
  if (!success) {
    const tErrors = await getTranslations("errors.integrations");
    throw tooManyRequests(tErrors("tooManyConnectionAttempts"));
  }
}

interface SerializableRepositoryOutput {
  id: string;
  outputType: string;
  enabled: boolean;
}

interface SerializableRepository {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  enabled: boolean;
  encryptedWebhookSecret?: string | null;
  hasWebhook?: boolean;
  outputs?: SerializableRepositoryOutput[];
}

interface SerializableIntegration {
  id: string;
  displayName: string;
  enabled: boolean;
  githubAppInstallationId?: string | null;
  managedByGitHubApp?: boolean;
  createdAt: Date;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  repositories: SerializableRepository[];
}

function serializeRepositoryOutput(
  output: SerializableRepositoryOutput
): RepositoryOutput {
  return {
    id: output.id,
    outputType: output.outputType,
    enabled: output.enabled,
  };
}

function serializeRepository(
  repository: SerializableRepository
): GitHubRepository {
  let hasWebhook: boolean | undefined;
  if (repository.encryptedWebhookSecret !== undefined) {
    hasWebhook = Boolean(repository.encryptedWebhookSecret);
  } else if (typeof repository.hasWebhook === "boolean") {
    hasWebhook = repository.hasWebhook;
  }

  return {
    id: repository.id,
    owner: repository.owner,
    repo: repository.repo,
    defaultBranch: repository.defaultBranch,
    enabled: repository.enabled,
    ...(hasWebhook === undefined ? {} : { hasWebhook }),
    ...(repository.outputs
      ? {
          outputs: repository.outputs.map(serializeRepositoryOutput),
        }
      : {}),
  };
}

function serializeIntegration(
  integration: SerializableIntegration
): GitHubIntegration {
  return {
    id: integration.id,
    displayName: integration.displayName,
    enabled: integration.enabled,
    managedByGitHubApp:
      integration.managedByGitHubApp ??
      Boolean(integration.githubAppInstallationId),
    createdAt: integration.createdAt.toISOString(),
    ...(integration.createdByUser
      ? { createdByUser: integration.createdByUser }
      : {}),
    repositories: integration.repositories.map(serializeRepository),
  };
}

function serializeListedIntegration(
  integration: SerializableIntegration & {
    type: string;
    connectionMethod?: GitHubConnectionMethod;
  }
): GitHubIntegration & {
  type: IntegrationType;
  connectionMethod?: GitHubConnectionMethod;
} {
  return {
    ...serializeIntegration(integration),
    type: integration.type as IntegrationType,
    ...(integration.connectionMethod
      ? { connectionMethod: integration.connectionMethod }
      : {}),
  };
}

function serializeCreatedByUser(
  user: { id: string; name: string; email: string; image: string | null } | null
) {
  return user
    ? { id: user.id, name: user.name, email: user.email, image: user.image }
    : undefined;
}

async function requireIntegrationInOrganization(
  organizationId: string,
  integrationId: string
) {
  const integration = await getGitHubIntegrationById(integrationId);

  if (!integration || integration.organizationId !== organizationId) {
    throw notFound("Integration not found");
  }

  return integration;
}

async function requireRepositoryInOrganization(
  organizationId: string,
  repositoryId: string
) {
  const repository = await getRepositoryById(repositoryId);

  if (!repository || repository.integration.organizationId !== organizationId) {
    throw notFound("Repository not found");
  }

  return repository;
}

async function requireOutputInOrganization(
  organizationId: string,
  outputId: string
) {
  const output = await getOutputById(outputId);

  if (
    !output ||
    output.repository.integration.organizationId !== organizationId
  ) {
    throw notFound("Output not found");
  }

  return output;
}

async function getAffectedSchedulesForIntegration(
  organizationId: string,
  integrationId: string
) {
  const allSchedules = await db.query.contentTriggers.findMany({
    columns: {
      enabled: true,
      id: true,
      name: true,
      qstashScheduleId: true,
      targets: true,
    },
    where: and(
      eq(contentTriggers.organizationId, organizationId),
      eq(contentTriggers.sourceType, "cron")
    ),
  });

  return allSchedules.filter((schedule) => {
    const parsed = triggerTargetsSchema.safeParse(schedule.targets);

    if (!parsed.success) {
      return false;
    }

    return parsed.data.repositoryIds.includes(integrationId);
  });
}

async function toKnownIntegrationError(error: unknown): Promise<Error> {
  if (error instanceof ORPCError) {
    return error;
  }
  if (error instanceof GitHubRepositoryAlreadyConnectedError) {
    const tCommon = await getTranslations("common");
    return conflict(tCommon("labels.repositoryAlreadyConnected"), {
      code: REPOSITORY_ALREADY_CONNECTED_CODE,
    });
  }

  if (error instanceof GitHubMultiRepositoryUnsupportedError) {
    const tErrors = await getTranslations("errors.integrations");
    return badRequest(tErrors("selectOneRepository"));
  }

  if (error instanceof GitHubBranchNotFoundError) {
    const tErrors = await getTranslations("errors.integrations");
    return badRequest(tErrors("branchNotFound"));
  }

  if (error instanceof GitHubRepositoryNotFoundError) {
    const tErrors = await getTranslations("errors.integrations");
    return badRequest(tErrors("repositoryInaccessible"));
  }

  if (error instanceof Error) {
    const tCommonErrors = await getTranslations("common.errors");
    return badRequest(tCommonErrors("generic"));
  }

  return internalServerError("Internal server error", error);
}

async function getInteractiveRepositoryToken(input: {
  organizationId: string;
  repositoryId: string;
}) {
  try {
    return await getTokenForIntegrationId(input.repositoryId, {
      organizationId: input.organizationId,
      requestTimeoutMs: GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
    });
  } catch (error) {
    if (
      hasGitHubStatus(error, 401) ||
      hasGitHubStatus(error, 404) ||
      error instanceof GitHubInstallationMissingError
    ) {
      const tErrors = await getTranslations("errors.integrations");
      throw forbidden(tErrors("githubAuthFailed"));
    }
    throw internalServerError("Failed to authenticate with GitHub", error);
  }
}

async function readContentDirectoryConfig(
  repositoryId: string,
  contentType: "blog_post" | "changelog",
  contentId?: string
) {
  const output = await db.query.repositoryOutputs.findFirst({
    where: and(
      eq(repositoryOutputs.repositoryId, repositoryId),
      eq(repositoryOutputs.outputType, contentType)
    ),
    columns: { config: true, reviewProcess: true },
  });
  const config = repositoryContentDirectoryConfigSchema.safeParse(
    output?.config
  );

  const repository = await db.query.githubIntegrations.findFirst({
    where: eq(githubIntegrations.id, repositoryId),
    columns: {
      id: true,
      organizationId: true,
      owner: true,
      repo: true,
      githubRepositoryId: true,
    },
  });
  const post =
    contentId && repository
      ? await db.query.posts.findFirst({
          where: and(
            eq(posts.id, contentId),
            eq(posts.organizationId, repository.organizationId)
          ),
          with: { collection: { columns: { projectId: true } } },
          columns: { id: true, githubPublish: true },
        })
      : null;
  const stored = postGitHubPublishSchema.safeParse(post?.githubPublish).data;
  const connectedSites =
    repository?.owner && repository.repo
      ? await listSiteGitHubPublishTargets({
          organizationId: repository.organizationId,
          projectId:
            stored?.repositoryId === repositoryId
              ? undefined
              : post?.collection.projectId,
          contentType,
          repository: {
            ...repository,
            owner: repository.owner,
            repo: repository.repo,
          },
        })
      : [];
  let savedSiteId =
    stored?.repositoryId === repositoryId ? stored.siteId : undefined;
  if (
    stored?.repositoryId === repositoryId &&
    repository?.owner &&
    repository.repo
  ) {
    let baseBranch = stored.baseBranch;
    if (stored.pullRequestNumber) {
      const token = await getInteractiveRepositoryToken({
        organizationId: repository.organizationId,
        repositoryId,
      });
      const pr = await createOctokit(token ?? undefined)
        .request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner: repository.owner,
          repo: repository.repo,
          pull_number: stored.pullRequestNumber,
        })
        .catch(() => null);
      baseBranch = pr?.data.base.ref ?? baseBranch;
    }
    const target = await findSiteGitHubPublishTarget({
      organizationId: repository.organizationId,
      contentType,
      existingPublication: { ...stored, baseBranch },
      repository: {
        ...repository,
        owner: repository.owner,
        repo: repository.repo,
      },
    }).catch(() => null);
    savedSiteId = target?.siteId;
  }
  if (stored?.repositoryId !== repositoryId) {
    savedSiteId ??= config.success
      ? (config.data.siteId ?? undefined)
      : undefined;
  }
  return {
    sites: connectedSites,
    reviewProcess: output?.reviewProcess ?? "pull_request",
    siteId: connectedSites.some((site) => site.id === savedSiteId)
      ? savedSiteId
      : null,
    directory: config.success ? (config.data.directory ?? null) : null,
    contentPath: config.success ? (config.data.contentPath ?? null) : null,
    imagePath: config.success ? (config.data.imagePath ?? null) : null,
  };
}

async function requireMcpServer(input: {
  organizationId: string;
  serverId: string;
}) {
  const existing = await getMcpConnectionIntegration({
    integrationId: input.serverId,
    organizationId: input.organizationId,
  });
  if (!existing || existing.organizationId !== input.organizationId) {
    throw notFound("MCP server not found");
  }
  return existing;
}

async function requireLinearIntegration(input: {
  organizationId: string;
  integrationId: string;
}) {
  const integration = await getLinearIntegrationById(input.integrationId);
  if (!integration || integration.organizationId !== input.organizationId) {
    throw notFound("Linear integration not found");
  }
  return integration;
}

async function requireGranolaIntegration(input: {
  organizationId: string;
  integrationId: string;
}) {
  const integration = await getGranolaIntegrationById(input.integrationId);
  if (!integration || integration.organizationId !== input.organizationId) {
    throw notFound("Granola integration not found");
  }
  return integration;
}

function getMcpOAuthRedirectUrl() {
  const baseUrl = getAppUrl();
  if (!baseUrl) {
    throw internalServerError("MCP OAuth is not configured");
  }
  return `${baseUrl}${MCP_OAUTH_CALLBACK_PATH}`;
}

export const integrationsRouter = {
  list: baseProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const result = await getIntegrationsByOrganization(input.organizationId);

      return {
        integrations: result.integrations.map(serializeListedIntegration),
        count: result.count,
      };
    }),
  create: baseProcedure
    .input(createGitHubIntegrationRequestSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);

      try {
        const displayName = `${input.owner}/${input.repo}`;

        const integration = await createGitHubIntegration({
          organizationId: input.organizationId,
          userId: auth.user.id,
          token: input.token || null,
          displayName,
          owner: input.owner,
          repo: input.repo,
          defaultBranch: input.branch || null,
        });

        await invalidateStandaloneChatIntegrations(input.organizationId);

        trackServerEvent({
          event: POSTHOG_EVENTS.INTEGRATION_CONNECTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            provider: INTEGRATION_PROVIDERS.GITHUB,
            auth_kind: input.token
              ? INTEGRATION_AUTH_KINDS.API_KEY
              : INTEGRATION_AUTH_KINDS.PUBLIC,
            integration_id: integration.id,
            has_branch: Boolean(input.branch),
          },
        });

        return serializeIntegration(integration);
      } catch (error) {
        throw await toKnownIntegrationError(error);
      }
    }),
  get: baseProcedure
    .input(integrationInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const integration = await requireIntegrationInOrganization(
        input.organizationId,
        input.integrationId
      );

      return serializeIntegration(integration);
    }),
  update: baseProcedure
    .input(integrationInputSchema.and(updateIntegrationBodySchema))
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);

      const integration = await requireIntegrationInOrganization(
        input.organizationId,
        input.integrationId
      );

      const repository = integration.repositories[0];
      const normalizedBranch =
        input.branch !== undefined ? input.branch || null : undefined;
      const ownerChanged =
        input.owner !== undefined &&
        repository !== undefined &&
        input.owner !== repository.owner;
      const repoChanged =
        input.repo !== undefined &&
        repository !== undefined &&
        input.repo !== repository.repo;
      const isRenaming = ownerChanged || repoChanged;
      const effectiveOwner = input.owner ?? repository?.owner ?? "";
      const effectiveRepo = input.repo ?? repository?.repo ?? "";

      if (normalizedBranch !== undefined) {
        if (integration.repositories.length !== 1) {
          throw badRequest(
            (await getTranslations("errors.integrations"))(
              "branchSingleRepoOnly"
            )
          );
        }
        if (!repository) {
          throw notFound("Repository not found");
        }
      }

      try {
        if (isRenaming) {
          const conflictingRepo = await findConflictingRepositoryInOrganization(
            input.organizationId,
            effectiveOwner,
            effectiveRepo,
            input.integrationId
          );

          if (conflictingRepo) {
            const tCommon = await getTranslations("common");
            throw conflict(tCommon("labels.repositoryAlreadyConnected"), {
              code: REPOSITORY_ALREADY_CONNECTED_CODE,
            });
          }

          await validateRepositoryAccess({
            owner: effectiveOwner,
            repo: effectiveRepo,
            token: input.token,
            encryptedToken: integration.encryptedToken,
          });

          await updateGitHubIntegration(input.integrationId, {
            owner: effectiveOwner,
            repo: effectiveRepo,
          });
        }

        if (input.token !== undefined) {
          await updateGitHubIntegrationToken(input.integrationId, input.token);
        }

        if (normalizedBranch !== undefined && repository) {
          if (normalizedBranch) {
            await validateRepositoryBranchExists({
              owner: effectiveOwner,
              repo: effectiveRepo,
              branch: normalizedBranch,
              token: input.token,
              encryptedToken: integration.encryptedToken,
            });
          }

          await updateRepository(repository.id, {
            defaultBranch: normalizedBranch,
          });
        }

        if (input.enabled !== undefined || input.displayName !== undefined) {
          await updateGitHubIntegration(input.integrationId, {
            enabled: input.enabled,
            displayName: input.displayName,
          });
        }

        const updated = await requireIntegrationInOrganization(
          input.organizationId,
          input.integrationId
        );

        await invalidateStandaloneChatIntegrations(input.organizationId);

        if (
          input.enabled !== undefined &&
          input.enabled !== integration.enabled
        ) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_TOGGLED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: INTEGRATION_PROVIDERS.GITHUB,
              integration_id: input.integrationId,
              enabled: input.enabled,
            },
          });
        }

        return serializeIntegration(updated);
      } catch (error) {
        throw await toKnownIntegrationError(error);
      }
    }),
  delete: baseProcedure
    .input(integrationInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await requireIntegrationInOrganization(
        input.organizationId,
        input.integrationId
      );

      const affectedSchedules = await getAffectedSchedulesForIntegration(
        input.organizationId,
        input.integrationId
      );

      await mapWithConcurrency(affectedSchedules, 4, async (schedule) => {
        if (schedule.qstashScheduleId) {
          await deleteQstashSchedule(schedule.qstashScheduleId).catch(
            (error) => {
              logError("Failed to delete qstash schedule", error, {
                scheduleId: schedule.qstashScheduleId,
              });
            }
          );
        }

        await db
          .update(contentTriggers)
          .set({
            enabled: false,
            qstashScheduleId: null,
            updatedAt: new Date(),
          })
          .where(eq(contentTriggers.id, schedule.id));
      });

      await deleteGitHubIntegration(input.integrationId);

      await invalidateStandaloneChatIntegrations(input.organizationId);

      trackServerEvent({
        event: POSTHOG_EVENTS.INTEGRATION_DISCONNECTED,
        headers: context.headers,
        userId: auth.user.id,
        organizationId: input.organizationId,
        properties: {
          provider: INTEGRATION_PROVIDERS.GITHUB,
          integration_id: input.integrationId,
          disabled_schedule_count: affectedSchedules.length,
        },
      });

      return {
        success: true,
        disabledSchedules: affectedSchedules.map((schedule) => ({
          id: schedule.id,
          name: schedule.name,
        })),
      };
    }),
  affectedSchedules: baseProcedure
    .input(integrationInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const integration = await requireIntegrationInOrganization(
        input.organizationId,
        input.integrationId
      );
      const affectedSchedules = await getAffectedSchedulesForIntegration(
        input.organizationId,
        input.integrationId
      );

      return {
        ...serializeIntegration(integration),
        affectedSchedules: affectedSchedules.map((schedule) => ({
          id: schedule.id,
          name: schedule.name,
          enabled: schedule.enabled,
        })),
      };
    }),
  repositories: {
    listAvailable: baseProcedure
      .input(integrationInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await requireIntegrationInOrganization(
          input.organizationId,
          input.integrationId
        );

        try {
          return await listAvailableRepositories(
            input.integrationId,
            auth.user.id
          );
        } catch (error) {
          throw await toKnownIntegrationError(error);
        }
      }),
    add: baseProcedure
      .input(integrationInputSchema.and(addRepositoryRequestSchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await assertActiveSubscription(input.organizationId);

        await requireIntegrationInOrganization(
          input.organizationId,
          input.integrationId
        );

        try {
          const repository = await addRepository({
            integrationId: input.integrationId,
            owner: input.owner,
            repo: input.repo,
            outputs: input.outputs,
            userId: auth.user.id,
          });

          await invalidateStandaloneChatIntegrations(input.organizationId);

          return repository;
        } catch (error) {
          throw await toKnownIntegrationError(error);
        }
      }),
    get: baseProcedure
      .input(repositoryInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const repository = await requireRepositoryInOrganization(
          input.organizationId,
          input.repositoryId
        );

        return serializeRepository(repository);
      }),
    update: baseProcedure
      .input(repositoryInputSchema.and(updateRepositoryBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await assertActiveSubscription(input.organizationId);

        const repository = await requireRepositoryInOrganization(
          input.organizationId,
          input.repositoryId
        );
        const normalizedDefaultBranch =
          input.defaultBranch !== undefined
            ? input.defaultBranch || null
            : undefined;

        try {
          if (normalizedDefaultBranch) {
            await validateRepositoryBranchExists({
              owner: repository.owner,
              repo: repository.repo,
              branch: normalizedDefaultBranch,
              encryptedToken: repository.integration.encryptedToken,
            });
          }

          await updateRepository(input.repositoryId, {
            ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
            ...(normalizedDefaultBranch !== undefined
              ? { defaultBranch: normalizedDefaultBranch }
              : {}),
          });

          const refreshed = await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );

          await invalidateStandaloneChatIntegrations(input.organizationId);

          return serializeRepository(refreshed);
        } catch (error) {
          throw await toKnownIntegrationError(error);
        }
      }),
    branches: {
      list: baseProcedure
        .input(repositoryInputSchema)
        .use(withOrganizationAccess)
        .handler(async ({ input }) => {
          const repository = await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );
          const token = await getInteractiveRepositoryToken(input);

          try {
            const octokit = createOctokit(token ?? undefined, {
              requestTimeoutMs: GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
            });
            const branches: string[] = [];
            let page = 1;
            let hasNextPage = true;

            while (hasNextPage) {
              const { data } = await octokit.request(
                "GET /repos/{owner}/{repo}/branches",
                {
                  owner: repository.owner,
                  repo: repository.repo,
                  page,
                  per_page: 100,
                  headers: GITHUB_API_VERSION_HEADERS,
                }
              );

              branches.push(...data.map((branch) => branch.name));
              hasNextPage = data.length === 100;
              page += 1;
            }

            return { branches };
          } catch (error) {
            if (hasGitHubStatus(error, 404)) {
              throw notFound("GitHub repository not found");
            }
            if (hasGitHubStatus(error, 401) || hasGitHubStatus(error, 403)) {
              const tErrors = await getTranslations("errors.integrations");
              throw forbidden(tErrors("repositoryAccessDenied"));
            }
            throw internalServerError("Failed to load GitHub branches", error);
          }
        }),
      create: baseProcedure
        .input(repositoryInputSchema.and(createRepositoryBranchBodySchema))
        .use(withOrganizationAccess)
        .handler(async ({ input }) => {
          await assertActiveSubscription(input.organizationId);

          const repository = await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );
          const baseBranch = repository.defaultBranch;
          if (!baseBranch) {
            const tErrors = await getTranslations("errors.integrations");
            throw badRequest(tErrors("publishingBranchRequired"));
          }

          const token = await getInteractiveRepositoryToken(input);

          try {
            const octokit = createOctokit(token ?? undefined);
            const { data: baseRef } = await octokit.request(
              "GET /repos/{owner}/{repo}/git/ref/{ref}",
              {
                owner: repository.owner,
                repo: repository.repo,
                ref: `heads/${baseBranch}`,
                headers: GITHUB_API_VERSION_HEADERS,
              }
            );

            await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
              owner: repository.owner,
              repo: repository.repo,
              ref: `refs/heads/${input.branchName}`,
              sha: baseRef.object.sha,
              headers: GITHUB_API_VERSION_HEADERS,
            });
          } catch (error) {
            if (hasGitHubStatus(error, 409)) {
              const tErrors = await getTranslations("errors.integrations");
              throw badRequest(tErrors("publishingBranchEmpty"));
            }
            if (hasGitHubStatus(error, 422)) {
              const tErrors = await getTranslations("errors.integrations");
              throw conflict(tErrors("branchInvalid"));
            }
            if (hasGitHubStatus(error, 404)) {
              throw notFound(
                "GitHub repository or publishing branch not found"
              );
            }
            if (hasGitHubStatus(error, 401) || hasGitHubStatus(error, 403)) {
              const tErrors = await getTranslations("errors.integrations");
              throw forbidden(tErrors("writeAccessRequired"));
            }
            throw internalServerError("Failed to create GitHub branch", error);
          }

          const updated = await updateRepository(input.repositoryId, {
            defaultBranch: input.branchName,
          }).catch((error: unknown) => {
            throw internalServerError(
              "The branch was created, but it could not be selected for publishing",
              error
            );
          });
          if (!updated) {
            throw internalServerError(
              "The branch was created, but it could not be selected for publishing"
            );
          }

          await invalidateStandaloneChatIntegrations(input.organizationId);
          const refreshed = await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );
          return serializeRepository(refreshed);
        }),
    },
    contentDirectory: {
      get: baseProcedure
        .input(repositoryInputSchema.and(repositoryContentDirectoryInputSchema))
        .use(withOrganizationAccess)
        .handler(async ({ input }) => {
          await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );

          return await readContentDirectoryConfig(
            input.repositoryId,
            input.contentType,
            input.contentId
          );
        }),
      update: baseProcedure
        .input(
          repositoryInputSchema.and(updateRepositoryContentDirectoryBodySchema)
        )
        .use(withOrganizationAccess)
        .handler(async ({ input }) => {
          await assertActiveSubscription(input.organizationId);

          await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );

          if (input.siteId) {
            const repository = await db.query.githubIntegrations.findFirst({
              where: eq(githubIntegrations.id, input.repositoryId),
            });
            const candidates =
              repository?.owner && repository.repo
                ? await listSiteGitHubPublishTargets({
                    organizationId: input.organizationId,
                    contentType: input.contentType,
                    repository: {
                      ...repository,
                      owner: repository.owner,
                      repo: repository.repo,
                    },
                  })
                : [];
            if (!candidates.some((site) => site.id === input.siteId)) {
              throw badRequest(
                (await getTranslations("errors.content"))(
                  "publishingSiteUnavailable"
                )
              );
            }
          }
          await setRepositoryOutputConfig({
            repositoryId: input.repositoryId,
            outputType: input.contentType,
            reviewProcess: input.reviewProcess,
            siteId: input.siteId,
            ...(input.directory !== undefined
              ? { directory: input.directory }
              : {}),
            ...(input.contentPath !== undefined
              ? { contentPath: input.contentPath }
              : {}),
            ...(input.imagePath !== undefined
              ? { imagePath: input.imagePath }
              : {}),
          });

          return await readContentDirectoryConfig(
            input.repositoryId,
            input.contentType,
            input.contentId
          );
        }),
    },
    directories: {
      list: baseProcedure
        .input(repositoryInputSchema.and(listRepositoryDirectoriesInputSchema))
        .use(withOrganizationAccess)
        .handler(async ({ input }) => {
          const repository = await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );
          if (!(repository.enabled && repository.integration.enabled)) {
            const tErrors = await getTranslations("errors.integrations");
            throw forbidden(tErrors("repositoryDisabled"));
          }
          const token = await getInteractiveRepositoryToken(input);

          if (!(token || isDemoMode())) {
            const tErrors = await getTranslations("errors.integrations");
            throw forbidden(tErrors("githubAuthFailed"));
          }

          try {
            const octokit = createOctokit(token ?? undefined, {
              requestTimeoutMs: GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
            });
            const requestOptions = {
              owner: repository.owner,
              repo: repository.repo,
              ...(repository.defaultBranch
                ? { ref: repository.defaultBranch }
                : {}),
              headers: GITHUB_API_VERSION_HEADERS,
            };
            const { data } = input.directory
              ? await octokit.request(
                  "GET /repos/{owner}/{repo}/contents/{path}",
                  {
                    ...requestOptions,
                    path: input.directory,
                  }
                )
              : await octokit.request("GET /repos/{owner}/{repo}/contents", {
                  ...requestOptions,
                });

            if (!Array.isArray(data)) {
              const tErrors = await getTranslations("errors.integrations");
              throw badRequest(tErrors("notADirectory"));
            }

            return {
              directories: data
                .flatMap((entry) =>
                  entry.type === "dir"
                    ? [{ name: entry.name, path: entry.path }]
                    : []
                )
                .sort((left, right) => left.name.localeCompare(right.name)),
              exists: true,
            };
          } catch (error) {
            if (hasGitHubStatus(error, 404)) {
              if (!input.directory) {
                throw notFound("Repository contents not found");
              }
              return { directories: [], exists: false };
            }
            if (hasGitHubStatus(error, 401) || hasGitHubStatus(error, 403)) {
              const tErrors = await getTranslations("errors.integrations");
              throw forbidden(tErrors("githubAccessDenied"));
            }
            if (error instanceof ORPCError) {
              throw error;
            }
            throw internalServerError(
              "Failed to load repository directories",
              error
            );
          }
        }),
    },
    delete: baseProcedure
      .input(repositoryInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await requireRepositoryInOrganization(
          input.organizationId,
          input.repositoryId
        );
        await deleteRepository(input.repositoryId);

        await invalidateStandaloneChatIntegrations(input.organizationId);

        return { success: true };
      }),
    configureOutput: baseProcedure
      .input(repositoryInputSchema.and(configureOutputBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await assertActiveSubscription(input.organizationId);

        await requireRepositoryInOrganization(
          input.organizationId,
          input.repositoryId
        );

        return configureOutput({
          repositoryId: input.repositoryId,
          outputType: input.outputType,
          enabled: input.enabled,
          config: input.config,
        });
      }),
    webhook: {
      repair: baseProcedure
        .input(repositoryInputSchema)
        .handler(async ({ context, input }) => {
          assertNotDemo();
          const auth = await assertOrganizationAccess({
            headers: context.headers,
            organizationId: input.organizationId,
          });
          await assertActiveSubscription(input.organizationId);
          await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );
          try {
            return await repairWebhookForRepository(
              input.repositoryId,
              auth.user.id
            );
          } catch (error) {
            if (error instanceof GitHubWebhookRepairPreconditionError) {
              throw badRequest(error.message);
            }
            if (hasGitHubStatus(error, 401) || hasGitHubStatus(error, 403)) {
              throw forbidden(
                "GitHub webhook access denied. Check your token permissions."
              );
            }
            throw internalServerError("Webhook repair failed. Please retry.");
          }
        }),
      get: baseProcedure
        .input(repositoryInputSchema)
        .use(withOrganizationAccess)
        .handler(async ({ context, input }) => {
          const { auth } = context;
          await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );

          let config: Awaited<ReturnType<typeof getWebhookConfigForRepository>>;
          try {
            config = await getWebhookConfigForRepository(
              input.repositoryId,
              auth.user.id
            );
          } catch (error) {
            throw await toKnownIntegrationError(error);
          }

          if (!config) {
            throw notFound("Webhook not configured");
          }

          return config;
        }),
      generateSecret: baseProcedure
        .input(repositoryInputSchema)
        .use(withOrganizationAccess)
        .handler(async ({ context, input }) => {
          const { auth } = context;
          await assertActiveSubscription(input.organizationId);

          await requireRepositoryInOrganization(
            input.organizationId,
            input.repositoryId
          );

          try {
            const secret = await generateWebhookSecretForRepository(
              input.repositoryId,
              auth.user.id
            );

            trackServerEvent({
              event: POSTHOG_EVENTS.WEBHOOK_SECRET_REGENERATED,
              headers: context.headers,
              userId: auth.user.id,
              organizationId: input.organizationId,
              properties: {
                repository_id: input.repositoryId,
              },
            });

            return secret;
          } catch (error) {
            throw await toKnownIntegrationError(error);
          }
        }),
    },
  },
  outputs: {
    update: baseProcedure
      .input(outputInputSchema.and(updateOutputBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await assertActiveSubscription(input.organizationId);

        const output = await requireOutputInOrganization(
          input.organizationId,
          input.outputId
        );

        const updatedOutput = await toggleOutput(input.outputId, input.enabled);

        if (
          updatedOutput &&
          input.enabled &&
          (output.outputType === "changelog" ||
            output.outputType === "blog_post")
        ) {
          await clearGitHubPublishFailures({
            organizationId: input.organizationId,
            outputType: output.outputType,
            repositoryId: output.repository.id,
          });
        }

        return updatedOutput;
      }),
  },
  linear: {
    list: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const integrations = await getLinearIntegrationsByOrganization(
          input.organizationId
        );

        return {
          integrations: integrations.map((integration) => ({
            id: integration.id,
            displayName: integration.displayName,
            enabled: integration.enabled,
            createdAt: integration.createdAt.toISOString(),
            linearOrganizationName: integration.linearOrganizationName,
            linearTeamName: integration.linearTeamName,
            createdByUser: serializeCreatedByUser(integration.createdByUser),
          })),
        };
      }),
    get: baseProcedure
      .input(integrationInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const integration = await requireLinearIntegration(input);

        return {
          id: integration.id,
          displayName: integration.displayName,
          enabled: integration.enabled,
          createdAt: integration.createdAt.toISOString(),
          linearOrganizationId: integration.linearOrganizationId,
          linearOrganizationName: integration.linearOrganizationName,
          linearTeamId: integration.linearTeamId,
          linearTeamName: integration.linearTeamName,
          createdByUser: serializeCreatedByUser(integration.createdByUser),
        };
      }),
    update: baseProcedure
      .input(integrationInputSchema.and(updateLinearIntegrationBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await assertActiveSubscription(input.organizationId);

        const existing = await requireLinearIntegration(input);

        const updated = await updateLinearIntegration(input.integrationId, {
          enabled: input.enabled,
          displayName: input.displayName,
          linearTeamId: input.linearTeamId,
          linearTeamName: input.linearTeamName,
        });

        await invalidateStandaloneChatIntegrations(input.organizationId);

        if (input.enabled !== undefined && input.enabled !== existing.enabled) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_TOGGLED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: INTEGRATION_PROVIDERS.LINEAR,
              integration_id: input.integrationId,
              enabled: input.enabled,
            },
          });
        }

        return (
          updated && {
            id: updated.id,
            displayName: updated.displayName,
            enabled: updated.enabled,
            linearTeamId: updated.linearTeamId,
            linearTeamName: updated.linearTeamName,
          }
        );
      }),
    delete: baseProcedure
      .input(integrationInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        const existing = await requireLinearIntegration(input);

        await deleteLinearIntegration(input.integrationId);

        await invalidateStandaloneChatIntegrations(input.organizationId);

        trackServerEvent({
          event: POSTHOG_EVENTS.INTEGRATION_DISCONNECTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            provider: INTEGRATION_PROVIDERS.LINEAR,
            integration_id: input.integrationId,
          },
        });

        return { success: true };
      }),
  },
  slack: {
    createChannel: baseProcedure
      .input(integrationInputSchema.and(slackCreateChannelBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        assertNotDemo();
        await assertActiveSubscription(input.organizationId);
        const integration = await getSlackIntegrationById(
          input.organizationId,
          input.integrationId
        );
        if (!integration?.enabled) {
          throw notFound("Active Slack integration not found");
        }
        const channel = await createSlackChannel(
          getSlackIntegrationBotToken(integration),
          input.name
        );
        await clearCachedSlackChannels(input.integrationId).catch((error) => {
          logError(
            "Failed to clear Slack channel cache after channel creation",
            error,
            { integrationId: input.integrationId }
          );
        });
        return { channel };
      }),
    list: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const integrations = await getSlackIntegrationsByOrganization(
          input.organizationId
        );

        return {
          integrations: integrations.map((integration) => ({
            id: integration.id,
            displayName: integration.displayName,
            enabled: integration.enabled,
            createdAt: integration.createdAt.toISOString(),
            slackTeamId: integration.slackTeamId,
            slackTeamName: integration.slackTeamName,
            allowedChannelIds: integration.allowedChannelIds ?? null,
            notificationChannelId: integration.notificationChannelId ?? null,
            createdByUser: serializeCreatedByUser(integration.createdByUser),
          })),
        };
      }),
    listChannels: baseProcedure
      .input(integrationInputSchema.and(slackListChannelsOptionsSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const integration = await getSlackIntegrationById(
          input.organizationId,
          input.integrationId
        );
        if (!integration) {
          throw notFound("Slack integration not found");
        }

        if (!input.refresh) {
          const cached = await getCachedSlackChannels(input.integrationId);
          if (cached) {
            return { channels: cached };
          }
        }

        const token = getSlackIntegrationBotToken(integration);
        const response = await fetch(
          "https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=200",
          { headers: { authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          throw internalServerError("Failed to load Slack channels");
        }
        const parsed = slackChannelListResponseSchema.safeParse(
          await response.json()
        );
        if (!(parsed.success && parsed.data.ok)) {
          throw internalServerError("Failed to load Slack channels");
        }

        const channels: SlackChannelOption[] = (
          parsed.data.channels ?? []
        ).flatMap((channel) =>
          channel.is_archived
            ? []
            : [
                {
                  id: channel.id,
                  name: channel.name ?? channel.id,
                  isPrivate: channel.is_private ?? false,
                  memberCount: channel.num_members ?? null,
                },
              ]
        );

        await setCachedSlackChannels(input.integrationId, channels);

        return { channels };
      }),
    update: baseProcedure
      .input(integrationInputSchema.and(updateSlackIntegrationBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await assertActiveSubscription(input.organizationId);

        const updated = await updateSlackIntegration({
          organizationId: input.organizationId,
          integrationId: input.integrationId,
          enabled: input.enabled,
          displayName: input.displayName,
          allowedChannelIds: input.allowedChannelIds,
          notificationChannelId: input.notificationChannelId,
        });
        if (!updated) {
          throw notFound("Slack integration not found");
        }

        if (input.enabled !== undefined) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_TOGGLED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: INTEGRATION_PROVIDERS.SLACK,
              integration_id: input.integrationId,
              enabled: input.enabled,
            },
          });
        }
        if (input.notificationChannelId !== undefined) {
          trackServerEvent({
            event: POSTHOG_EVENTS.SLACK_CHANNEL_CONFIGURED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              integration_id: input.integrationId,
              kind: SLACK_CHANNEL_KINDS.NOTIFICATIONS,
              cleared: input.notificationChannelId === null,
            },
          });
        }
        if (input.allowedChannelIds !== undefined) {
          trackServerEvent({
            event: POSTHOG_EVENTS.SLACK_CHANNEL_CONFIGURED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              integration_id: input.integrationId,
              kind: SLACK_CHANNEL_KINDS.ACCESS,
              channel_count: input.allowedChannelIds?.length ?? 0,
              cleared: input.allowedChannelIds === null,
            },
          });
        }

        return {
          id: updated.id,
          displayName: updated.displayName,
          enabled: updated.enabled,
          allowedChannelIds: updated.allowedChannelIds ?? null,
          notificationChannelId: updated.notificationChannelId ?? null,
        };
      }),
    delete: baseProcedure
      .input(integrationInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        const deleted = await deleteSlackIntegration(
          input.organizationId,
          input.integrationId
        );
        if (!deleted) {
          throw notFound("Slack integration not found");
        }

        await clearCachedSlackChannels(input.integrationId);

        trackServerEvent({
          event: POSTHOG_EVENTS.INTEGRATION_DISCONNECTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            provider: INTEGRATION_PROVIDERS.SLACK,
            integration_id: input.integrationId,
          },
        });

        return { success: true };
      }),
  },
  granola: {
    list: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const integrations = await getGranolaIntegrationsByOrganization(
          input.organizationId
        );

        return {
          integrations: integrations.map((integration) => ({
            id: integration.id,
            displayName: integration.displayName,
            enabled: integration.enabled,
            createdAt: integration.createdAt.toISOString(),
            workspaceName: integration.workspaceName,
            createdByUser: serializeCreatedByUser(integration.createdByUser),
          })),
        };
      }),
    get: baseProcedure
      .input(integrationInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const integration = await requireGranolaIntegration(input);

        return {
          id: integration.id,
          displayName: integration.displayName,
          enabled: integration.enabled,
          createdAt: integration.createdAt.toISOString(),
          workspaceName: integration.workspaceName,
          createdByUser: serializeCreatedByUser(integration.createdByUser),
        };
      }),
    create: baseProcedure
      .input(createGranolaIntegrationRequestSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { user } = context.auth;
        await assertActiveSubscription(input.organizationId);

        const { success } = await ratelimit.granolaConnection.limit(
          input.organizationId
        );
        if (!success) {
          const tErrors = await getTranslations("errors.integrations");
          throw tooManyRequests(tErrors("tooManyConnectionAttempts"));
        }

        const verification = await verifyGranolaApiKey(input.apiKey);
        if (!verification.valid) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_CONNECT_FAILED,
            headers: context.headers,
            userId: user.id,
            organizationId: input.organizationId,
            properties: {
              provider: INTEGRATION_PROVIDERS.GRANOLA,
              auth_kind: INTEGRATION_AUTH_KINDS.API_KEY,
              error_code: "invalid_api_key",
            },
          });
          throw badRequest(
            (await getTranslations("errors.integrations"))("granolaKeyRejected")
          );
        }

        const integration = await createGranolaIntegration({
          organizationId: input.organizationId,
          userId: user.id,
          displayName: input.displayName,
          apiKey: input.apiKey,
          workspaceName: input.workspaceName,
        });

        if (!integration) {
          throw internalServerError("Failed to create Granola integration");
        }

        await invalidateStandaloneChatIntegrations(input.organizationId);

        trackServerEvent({
          event: POSTHOG_EVENTS.INTEGRATION_CONNECTED,
          headers: context.headers,
          userId: user.id,
          organizationId: input.organizationId,
          properties: {
            provider: INTEGRATION_PROVIDERS.GRANOLA,
            auth_kind: INTEGRATION_AUTH_KINDS.API_KEY,
            integration_id: integration.id,
          },
        });

        return {
          id: integration.id,
          displayName: integration.displayName,
          enabled: integration.enabled,
          createdAt: integration.createdAt.toISOString(),
          workspaceName: integration.workspaceName,
        };
      }),
    update: baseProcedure
      .input(integrationInputSchema.and(updateGranolaIntegrationBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await assertActiveSubscription(input.organizationId);

        const existing = await requireGranolaIntegration(input);

        const updated = await updateGranolaIntegration(input.integrationId, {
          enabled: input.enabled,
          displayName: input.displayName,
          workspaceName: input.workspaceName,
        });

        if (!updated) {
          throw internalServerError("Failed to update Granola integration");
        }

        await invalidateStandaloneChatIntegrations(input.organizationId);

        if (input.enabled !== undefined && input.enabled !== existing.enabled) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_TOGGLED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: INTEGRATION_PROVIDERS.GRANOLA,
              integration_id: input.integrationId,
              enabled: input.enabled,
            },
          });
        }

        return {
          id: updated.id,
          displayName: updated.displayName,
          enabled: updated.enabled,
          createdAt: updated.createdAt.toISOString(),
          workspaceName: updated.workspaceName,
        };
      }),
    delete: baseProcedure
      .input(integrationInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        const existing = await requireGranolaIntegration(input);

        await deleteGranolaIntegration(input.integrationId);

        await invalidateStandaloneChatIntegrations(input.organizationId);

        trackServerEvent({
          event: POSTHOG_EVENTS.INTEGRATION_DISCONNECTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            provider: INTEGRATION_PROVIDERS.GRANOLA,
            integration_id: input.integrationId,
          },
        });

        return { success: true };
      }),
  },
  mcp: {
    list: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const [integrations, storeIntegrations] = await Promise.all([
          getMcpConnectionIntegrationsByOrganization(input.organizationId),
          listLiveMcpStoreIntegrations(),
        ]);
        const liveStoreIntegrationIds = new Set(
          storeIntegrations.map((integration) => integration.id)
        );
        const customIntegrations = integrations.filter(
          (integration) =>
            !integration.storeSourceIntegrationId ||
            !liveStoreIntegrationIds.has(integration.storeSourceIntegrationId)
        );
        return {
          servers: customIntegrations.map(serializeMcpServerIntegration),
          count: customIntegrations.length,
        };
      }),
    storeList: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const [storeIntegrations, ownIntegrations] = await Promise.all([
          listLiveMcpStoreIntegrations(),
          getMcpConnectionIntegrationsByOrganization(input.organizationId),
        ]);

        const connectionsByStoreIntegrationId = new Map(
          ownIntegrations.flatMap((integration) =>
            integration.storeSourceIntegrationId
              ? [[integration.storeSourceIntegrationId, integration] as const]
              : []
          )
        );

        return {
          integrations: storeIntegrations.map((integration) => {
            const connection = connectionsByStoreIntegrationId.get(
              integration.id
            );
            return {
              id: integration.id,
              slug: integration.slug,
              name: integration.name,
              url: integration.url,
              description: integration.description,
              author: integration.author,
              websiteUrl: integration.websiteUrl,
              brandColor: integration.brandColor,
              logoLightUrl: integration.logoLightUrl,
              logoDarkUrl: integration.logoDarkUrl,
              authType: integration.authType,
              indexedToolCount: integration.indexedToolCount,
              connected: Boolean(connection),
              connection: connection
                ? serializeMcpServerIntegration(connection)
                : null,
            };
          }),
        };
      }),
    create: baseProcedure
      .input(createMcpServerRequestSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const auth = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        await assertMcpConnectionRateLimit(input.organizationId);
        await assertActiveSubscription(input.organizationId);

        const storeIntegration = input.storeIntegrationId
          ? await getLiveMcpStoreIntegrationById(input.storeIntegrationId)
          : null;
        if (input.storeIntegrationId && !storeIntegration) {
          throw notFound("MCP store integration not found");
        }
        if (
          storeIntegration &&
          storeIntegration.authType !== "none" &&
          storeIntegration.authType !== "headers"
        ) {
          const tErrors = await getTranslations("errors.integrations");
          throw badRequest(tErrors("mcpOAuthRequired"));
        }
        if (storeIntegration && input.authType !== storeIntegration.authType) {
          const tErrors = await getTranslations("errors.integrations");
          throw badRequest(tErrors("useApprovedAuth"));
        }

        try {
          const integration = await createMcpConnectionIntegration({
            authType: input.authType,
            organizationId: input.organizationId,
            userId: auth.user.id,
            name: storeIntegration?.name ?? input.name,
            url: storeIntegration?.url ?? input.url,
            description:
              storeIntegration?.description ?? input.description ?? null,
            author: storeIntegration?.author ?? null,
            websiteUrl: storeIntegration?.websiteUrl ?? null,
            brandColor: storeIntegration?.brandColor ?? null,
            logoLightUrl: storeIntegration?.logoLightUrl ?? null,
            logoDarkUrl: storeIntegration?.logoDarkUrl ?? null,
            bannerUrl: storeIntegration?.bannerUrl ?? null,
            storeSourceIntegrationId: storeIntegration?.id ?? null,
            headers: input.headers,
          });

          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_CONNECTED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: storeIntegration
                ? INTEGRATION_PROVIDERS.MCP_STORE
                : INTEGRATION_PROVIDERS.MCP,
              auth_kind: toMcpIntegrationAuthKind(input.authType),
              integration_id: integration.id,
              store_integration_id: storeIntegration?.id ?? null,
            },
          });

          return serializeMcpServerIntegration(integration);
        } catch (error) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_CONNECT_FAILED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: storeIntegration
                ? INTEGRATION_PROVIDERS.MCP_STORE
                : INTEGRATION_PROVIDERS.MCP,
              auth_kind: toMcpIntegrationAuthKind(input.authType),
              error_code: isPgUniqueViolation(error)
                ? "name_conflict"
                : "create_failed",
            },
          });
          if (isPgUniqueViolation(error)) {
            const tErrors = await getTranslations("errors.integrations");
            throw conflict(tErrors("mcpNameTaken"));
          }
          if (error instanceof PublicUrlValidationError) {
            throw badRequest(
              (await getTranslations("errors.integrations"))("publicUrlInvalid")
            );
          }
          if (error instanceof McpStoreListingUnavailableError) {
            throw notFound(error.message);
          }

          throw internalServerError("Failed to create MCP server", error);
        }
      }),
    update: baseProcedure
      .input(mcpServerInputSchema.and(updateMcpServerBodySchema))
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const auth = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        await assertActiveSubscription(input.organizationId);

        const existing = await requireMcpServer(input);
        let updated:
          | Awaited<ReturnType<typeof updateMcpConnectionIntegration>>
          | undefined;
        try {
          updated = await updateMcpConnectionIntegration(
            {
              integrationId: input.serverId,
              organizationId: input.organizationId,
            },
            {
              authType: input.authType,
              name: input.name,
              url: input.url,
              description: input.description,
              headers: input.headers,
              enabled: input.enabled,
            }
          );
        } catch (error) {
          if (isPgUniqueViolation(error)) {
            const tErrors = await getTranslations("errors.integrations");
            throw conflict(tErrors("mcpNameTaken"));
          }
          if (error instanceof PublicUrlValidationError) {
            throw badRequest(
              (await getTranslations("errors.integrations"))("publicUrlInvalid")
            );
          }

          throw internalServerError("Failed to update MCP server", error);
        }

        if (!updated) {
          throw notFound("MCP server not found");
        }

        if (input.enabled !== undefined && input.enabled !== existing.enabled) {
          trackServerEvent({
            event: POSTHOG_EVENTS.INTEGRATION_TOGGLED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              provider: existing.storeSourceIntegrationId
                ? INTEGRATION_PROVIDERS.MCP_STORE
                : INTEGRATION_PROVIDERS.MCP,
              integration_id: input.serverId,
              enabled: input.enabled,
            },
          });
        }

        return serializeMcpServerIntegration(updated);
      }),
    beginOAuth: baseProcedure
      .input(beginMcpOAuthRequestSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const access = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        await assertMcpConnectionRateLimit(input.organizationId);
        await assertActiveSubscription(input.organizationId);

        const redirectUrl = getMcpOAuthRedirectUrl();

        const storeIntegration = input.storeIntegrationId
          ? await getLiveMcpStoreIntegrationById(input.storeIntegrationId)
          : null;
        if (input.storeIntegrationId && !storeIntegration) {
          throw notFound("MCP store integration not found");
        }
        if (storeIntegration && storeIntegration.authType !== "oauth") {
          const tErrors = await getTranslations("errors.integrations");
          throw badRequest(tErrors("mcpOAuthNotSupported"));
        }

        try {
          return await Effect.runPromise(
            beginMcpOAuthAuthorization({
              organizationId: input.organizationId,
              userId: access.user.id,
              name: storeIntegration?.name ?? input.name,
              url: storeIntegration?.url ?? input.url,
              description: storeIntegration?.description ?? input.description,
              storeSourceIntegrationId: storeIntegration?.id,
              callbackPath: input.callbackPath,
              redirectUrl,
              resourceType: "connection",
            })
          );
        } catch (error) {
          if (
            error instanceof McpOAuthAuthorizationError ||
            error instanceof PublicUrlValidationError
          ) {
            throw badRequest(
              (await getTranslations("errors.integrations"))(
                "mcpAuthorizationFailed"
              )
            );
          }
          if (isPgUniqueViolation(error)) {
            const tErrors = await getTranslations("errors.integrations");
            throw conflict(tErrors("mcpNameTaken"));
          }
          if (error instanceof McpOAuthNameConflictError) {
            throw conflict(
              (await getTranslations("errors.integrations"))("mcpNameTaken")
            );
          }
          throw internalServerError("Failed to start MCP OAuth", error);
        }
      }),
    reauthorizeOAuth: baseProcedure
      .input(reauthorizeMcpOAuthRequestSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const access = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        await assertMcpConnectionRateLimit(input.organizationId);
        await assertActiveSubscription(input.organizationId);

        const existing = await getMcpConnectionIntegration({
          integrationId: input.serverId,
          organizationId: input.organizationId,
        });
        if (
          !existing ||
          existing.organizationId !== input.organizationId ||
          existing.authType !== "oauth"
        ) {
          throw notFound("OAuth MCP server not found");
        }
        const redirectUrl = getMcpOAuthRedirectUrl();

        try {
          return await Effect.runPromise(
            beginMcpOAuthAuthorization({
              organizationId: input.organizationId,
              userId: access.user.id,
              serverIntegrationId: existing.id,
              name: existing.name,
              url: existing.url,
              description: existing.description,
              callbackPath: input.callbackPath,
              redirectUrl,
              resourceType: "connection",
            })
          );
        } catch (error) {
          if (
            error instanceof McpOAuthAuthorizationError ||
            error instanceof PublicUrlValidationError
          ) {
            throw badRequest(
              (await getTranslations("errors.integrations"))(
                "mcpAuthorizationFailed"
              )
            );
          }
          throw internalServerError("Failed to restart MCP OAuth", error);
        }
      }),
    delete: baseProcedure
      .input(mcpServerInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        const existing = await requireMcpServer(input);
        const deleted = await deleteMcpConnectionIntegration({
          integrationId: input.serverId,
          organizationId: input.organizationId,
        });
        if (!deleted) {
          throw notFound("MCP connection not found");
        }

        trackServerEvent({
          event: POSTHOG_EVENTS.INTEGRATION_DISCONNECTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            provider: existing.storeSourceIntegrationId
              ? INTEGRATION_PROVIDERS.MCP_STORE
              : INTEGRATION_PROVIDERS.MCP,
            integration_id: input.serverId,
            auth_kind: toMcpIntegrationAuthKind(existing.authType),
          },
        });

        return { success: true };
      }),
    refreshTools: baseProcedure
      .input(mcpServerInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const auth = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        await assertMcpConnectionRateLimit(input.organizationId);
        await assertActiveSubscription(input.organizationId);

        const existing = await requireMcpServer(input);
        try {
          const result = await refreshMcpToolIndexForIntegration({
            organizationId: input.organizationId,
            integrationId: input.serverId,
          });
          const refreshed = await getMcpConnectionIntegration({
            integrationId: input.serverId,
            organizationId: input.organizationId,
          });
          trackServerEvent({
            event: POSTHOG_EVENTS.MCP_TOOLS_REFRESHED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              integration_id: input.serverId,
              tool_count: result.indexedToolCount,
            },
          });
          return {
            success: true,
            indexedToolCount: result.indexedToolCount,
            server: refreshed
              ? serializeMcpServerIntegration(refreshed)
              : undefined,
          };
        } catch (error) {
          if (error instanceof PublicUrlValidationError) {
            throw badRequest(
              (await getTranslations("errors.integrations"))("publicUrlInvalid")
            );
          }

          throw internalServerError("Failed to refresh MCP tools", error);
        }
      }),
    test: baseProcedure
      .input(testMcpServerRequestSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const auth = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        await assertMcpConnectionRateLimit(input.organizationId);
        await assertActiveSubscription(input.organizationId);

        const result = await testMcpServerConnection({
          url: input.url,
          headers: input.headers,
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.MCP_CONNECTION_TESTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            outcome: result.success
              ? MCP_CONNECTION_TEST_OUTCOMES.SUCCESS
              : MCP_CONNECTION_TEST_OUTCOMES.FAILED,
            tool_count: result.toolCount,
            has_headers: Object.keys(input.headers ?? {}).length > 0,
          },
        });

        return result;
      }),
  },
};
