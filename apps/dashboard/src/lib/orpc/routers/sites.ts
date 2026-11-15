import {
  listGitHubAppInstallationsByOrganization,
  listGitHubAppRepositoriesEffect,
  setSelectedGitHubAppRepositoriesEffect,
} from "@notra/ai/integrations/github";
import { getOpenRequestLogger } from "@notra/ai/utils/evlog-request";
import { db } from "@notra/db/drizzle";
import {
  githubIntegrations,
  projects,
  siteDeployments,
  siteDomains,
  sites,
} from "@notra/db/schema";
import { loadSiteAnalytics } from "@notra/geo-core/geo/web-analytics";
import { geoWindow } from "@notra/geo-core/geo/window";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import {
  siteEditorScopeInputSchema,
  siteBranchesListInputSchema,
  siteBranchInputSchema,
  siteBranchFlushInputSchema,
  siteBranchCreateInputSchema,
  siteBranchRenameInputSchema,
  addSiteDomainInputSchema,
  connectSiteRepositoryInputSchema,
  createSiteInputSchema,
  createSitesInputSchema,
  createPostPreviewInputSchema,
  repositorySuggestionsInputSchema,
  siteRepositorySuggestionsInputSchema,
  listSiteDeploymentsInputSchema,
  listSitesInputSchema,
  postPreviewSitesInputSchema,
  publishSiteDraftsInputSchema,
  saveSiteDraftInputSchema,
  setSiteSuspendedInputSchema,
  siteBranchPreviewInputSchema,
  siteDeploymentInputSchema,
  siteDomainInputSchema,
  saveSiteIntegrationInputSchema,
  siteFilePathInputSchema,
  siteDraftMutationInputSchema,
  sitePostPreviewInputSchema,
  sitePreviewAccessInputSchema,
  sitePreviewInputSchema,
  siteAnalyticsInputSchema,
  siteScopeInputSchema,
  siteSetPreviewPasswordInputSchema,
  siteStarterInputSchema,
  updatePostPreviewAccessInputSchema,
  updateSiteInputSchema,
  uploadSiteImageInputSchema,
  connectSiteInthProjectInputSchema,
} from "@notra/schemas/dashboard/sites";
import {
  SITE_CONFIG_FILENAME,
  SITE_R2_KEYS,
} from "@notra/sites-core/constants/sites";
import type { SiteServingState } from "@notra/sites-core/types/deployment";
import { hashBuildTarget } from "@notra/sites-core/utils/build-target";
import { postPreviewKey } from "@notra/sites-core/utils/hosts";
import { isSiteImageDraftPath } from "@notra/sites-core/utils/image-drafts";
import {
  createSiteBranch,
  discardDeletedSiteBranchDrafts,
  deleteSiteBranch,
  listSiteBranches,
  mergeSiteBranch,
  renameSiteBranch,
  requestSiteBranchReview,
  siteBranchStatus,
} from "@notra/sites-server/branches";
import { getBuildTelemetry } from "@notra/sites-server/build-telemetry";
import {
  deployBranchHead,
  promoteLatestDeployment,
  redeploy,
  rollbackToDeployment,
} from "@notra/sites-server/deploy";
import {
  getDeployment,
  getProductionDeploymentHistory,
  getSite,
  listSiteDeployments,
} from "@notra/sites-server/deployments";
import { dnsSetupForDomain } from "@notra/sites-server/dns-setup";
import {
  addSiteDomain,
  refreshSiteDomain,
  removeSiteDomain,
} from "@notra/sites-server/domains";
import {
  flushSiteDrafts,
  discardSiteDraft,
  listSiteSourceFiles,
  publishSiteDrafts,
  readPublishedFile,
  readSiteDraft,
  rebaseSiteDraft,
  saveSiteDraft,
  validateSiteDrafts,
} from "@notra/sites-server/editor";
import {
  getSitesHostingDomain,
  getSitesHostingPortSuffix,
  isSitesConfigured,
  siteCnameTarget,
} from "@notra/sites-server/env";
import { SiteInputError } from "@notra/sites-server/errors/sites";
import {
  getRepositorySuggestions,
  getSiteRepositoryOverview,
  siteRepositoryAccess,
} from "@notra/sites-server/github";
import {
  listPendingSiteDraftSummaries,
  saveSiteImageDraft,
} from "@notra/sites-server/image-drafts";
import {
  readSiteIntegrations,
  saveSiteIntegration,
} from "@notra/sites-server/integrations";
import {
  connectSiteToInthProject,
  disconnectInth,
  getInthConsentStatus,
  listInthProjects,
} from "@notra/sites-server/inth";
import { getSitePlanUsage } from "@notra/sites-server/plan-limits";
import {
  previewAccessUrl,
  setSitePreviewPassword,
} from "@notra/sites-server/preview-access";
import {
  createBranchPreview,
  deletePreview,
  updatePostPreviewAccess,
} from "@notra/sites-server/previews";
import { r2GetText } from "@notra/sites-server/r2";
import { organizationRepositorySuggestions } from "@notra/sites-server/repositories";
import {
  createSite,
  deleteSite,
  setSiteSuspended,
  updateSiteSettings,
} from "@notra/sites-server/sites";
import {
  createSiteStarter,
  siteStarterStatus,
} from "@notra/sites-server/starter";
import { readServingState } from "@notra/sites-server/state";
import type { Site } from "@notra/sites-server/types/sites";
import { defaultSiteConfigContent } from "@notra/sites-server/utils/default-config";
import { siteSourceContext } from "@notra/sites-server/utils/source-context";
import {
  buildTargetForDeployment,
  primaryMountUrl,
  siteAliasOrigin,
  sitePreviewOrigin,
} from "@notra/sites-server/utils/urls";
import { isDemoMode } from "@notra/utils/demo-mode";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Effect } from "effect";

import {
  SITE_ADMIN_ROLES,
  SITE_DEPLOYMENTS_PAGE_LIMIT,
} from "@/constants/sites";
import { purgeDeletedAnalytics } from "@/lib/analytics/deleted-analytics-purge";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { afterResponse } from "@/lib/framework/after-response";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure } from "@/lib/orpc/base";
import { runOrpcEffect } from "@/lib/orpc/effect";
import {
  assertNotDemo,
  badRequest,
  forbidden,
  notFound,
  serviceUnavailable,
  tooManyRequests,
} from "@/lib/orpc/utils/errors";
import { toGeoOrpcError } from "@/lib/orpc/utils/geo-errors";
import { assertSitesAccess } from "@/lib/sites/access";
import { dispatchSiteJobs } from "@/lib/sites/dispatch";
import { isSitesBulkImportEnabled } from "@/lib/sites/flag";
import {
  notifyDomainConnected,
  notifySitesCreated,
} from "@/lib/sites/info-channel";
import {
  bulkImportErrorMessage,
  toSitesOrpcError,
} from "@/lib/sites/orpc-errors";
import {
  listPostPreviewSites,
  postPreviewStatus,
  previewPostOnSite,
} from "@/lib/sites/post-preview";
import {
  liveDeploymentsFromState,
  serializeDeployment,
  serializeDomain,
  serializePreviews,
  serializeSite,
} from "@/lib/sites/serialize";
import { SvgSanitizationError } from "@/lib/upload/sanitize-svg";
import type { SiteScope } from "@/types/sites";
import type {
  CreateSitesResult,
  SiteDeploymentAccess,
  SiteAccessOptions,
  SiteRequestContext,
} from "@/types/sites-server";
import { toGitHubOperationOrpcError } from "@/utils/github-operation-error";
import {
  prepareSiteImage,
  SiteImageInputError,
} from "@/utils/prepare-site-image";
import { ratelimit } from "@/utils/ratelimit";
import {
  canUndoSiteRollback,
  siteDeploymentActions,
} from "@/utils/site-deployment-actions";

const sitesAccessProcedure = authorizedProcedure.use(
  async ({ context, next }, input) => {
    const { organizationId } = organizationIdInputSchema.parse(input);
    await assertSitesAccess({ headers: context.headers, organizationId });
    return next();
  }
);

const sitesProcedure = sitesAccessProcedure.use(async ({ next }) => {
  if (!isSitesConfigured()) {
    throw serviceUnavailable(
      "Notra Sites is not configured on this environment"
    );
  }
  try {
    return await next();
  } catch (error) {
    throw toSitesOrpcError(error);
  }
});

function dispatchLater(jobIds: Array<string | null>) {
  const ids = jobIds.filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    afterResponse(() => dispatchSiteJobs(ids));
  }
}

async function deployPublishedCommit(
  site: Site,
  commitSha: string,
  userId: string
): Promise<boolean> {
  try {
    dispatchLater([
      await deployBranchHead(site, { trigger: "manual", userId, commitSha }),
    ]);
    return false;
  } catch {
    getOpenRequestLogger()?.set({
      sitesPublish: { siteId: site.id, commitSha, deployPending: true },
    });
    return true;
  }
}

// Same budget as agent previews: every post preview starts a site build.
async function assertPostPreviewRateLimit(organizationId: string) {
  if (
    !(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    )
  ) {
    return;
  }
  const { success } = await ratelimit.githubPublish.limit(
    `agent-preview:${organizationId}`
  );
  if (!success) {
    throw tooManyRequests(
      (await getTranslations("errors"))("tooManySitePreviews")
    );
  }
}

async function requireSite(
  context: SiteRequestContext,
  input: SiteScope,
  options: SiteAccessOptions = {}
): Promise<SiteDeploymentAccess> {
  const access = await assertOrganizationAccess({
    headers: context.headers,
    organizationId: input.organizationId,
  });
  if (options.admin && !SITE_ADMIN_ROLES.has(access.membership.role)) {
    throw forbidden("Only owners and admins can do this");
  }
  const site = await getSite(input.siteId);
  if (!site || site.organizationId !== input.organizationId) {
    throw notFound("Site not found");
  }
  return {
    site,
    userId: access.user.id,
    canManageDeployments: SITE_ADMIN_ROLES.has(access.membership.role),
  };
}

async function servingState(siteId: string) {
  return (await readServingState(siteId))?.state ?? null;
}

async function serializeDeploymentList(
  site: Site,
  deployments: Awaited<ReturnType<typeof listSiteDeployments>>,
  state: SiteServingState | null,
  canManageDeployments: boolean
) {
  const [currentHash, history] = await Promise.all([
    hashBuildTarget(
      buildTargetForDeployment({ site, kind: "production", previewKey: null })
    ),
    getProductionDeploymentHistory(site.id),
  ]);
  const actionsContext = {
    history,
    currentHash,
    liveDeploymentId: state?.production?.deploymentId ?? null,
    rollbackActive: state?.productionRollback ?? false,
    canManageDeployments,
    siteActive: site.status === "active",
  };
  const live = liveDeploymentsFromState(state);
  const listedIds = new Set(deployments.map((deployment) => deployment.id));
  const retainedDeployments = [
    ...deployments,
    ...history.filter((deployment) => !listedIds.has(deployment.id)),
  ];
  return {
    canUndoRollback: canUndoSiteRollback(actionsContext),
    deployments: retainedDeployments.map((deployment) => ({
      ...serializeDeployment(deployment, live),
      ...siteDeploymentActions(deployment, actionsContext),
    })),
  };
}

export const sitesRouter = {
  status: sitesAccessProcedure
    .input(organizationIdInputSchema)
    .handler(async ({ input }) => {
      const configured = isSitesConfigured();
      const hostingDomain = configured
        ? `${getSitesHostingDomain()}${getSitesHostingPortSuffix()}`
        : null;
      return { configured, hostingDomain };
    }),

  planUsage: sitesProcedure
    .input(organizationIdInputSchema)
    .handler(async ({ input }) => await getSitePlanUsage(input.organizationId)),

  list: sitesAccessProcedure
    .input(listSitesInputSchema)
    .handler(async ({ input }) => {
      const project = await db.query.projects.findFirst({
        columns: { id: true },
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.organizationId, input.organizationId)
        ),
      });
      if (!project) {
        throw notFound("Project not found");
      }
      if (!isSitesConfigured()) {
        return { configured: false, sites: [] };
      }
      const rows = await db.query.sites.findMany({
        where: and(
          eq(sites.organizationId, input.organizationId),
          eq(sites.projectId, input.projectId)
        ),
        orderBy: [desc(sites.createdAt)],
        with: {
          deployments: {
            where: eq(siteDeployments.kind, "production"),
            orderBy: [desc(siteDeployments.createdAt)],
            limit: 1,
          },
        },
      });
      const details = await Promise.all(
        rows.map(async (site) => ({
          site,
          latest: site.deployments[0],
          state: await servingState(site.id),
        }))
      );
      return {
        configured: true,
        sites: details.map(({ site, latest, state }) => ({
          ...serializeSite(site, state),
          latestDeployment: latest
            ? serializeDeployment(latest, liveDeploymentsFromState(state))
            : null,
        })),
      };
    }),

  importableRepositories: sitesAccessProcedure
    .input(organizationIdInputSchema)
    .handler(async ({ input }) => {
      const installations = await listGitHubAppInstallationsByOrganization(
        input.organizationId
      );
      if (installations.length === 0) {
        return { installed: false, repositories: [] };
      }
      const [available, connected] = await Promise.all([
        runOrpcEffect(
          listGitHubAppRepositoriesEffect(input.organizationId, installations),
          toGitHubOperationOrpcError
        ),
        db
          .select({
            id: githubIntegrations.id,
            githubRepositoryId: githubIntegrations.githubRepositoryId,
          })
          .from(githubIntegrations)
          .where(
            and(
              eq(githubIntegrations.organizationId, input.organizationId),
              isNotNull(githubIntegrations.githubRepositoryId)
            )
          ),
      ]);
      const integrationByRepository = new Map(
        connected.map((row) => [row.githubRepositoryId, row.id])
      );
      return {
        installed: true,
        repositories: available.map((repository) => ({
          githubRepositoryId: repository.id,
          owner: repository.owner,
          repo: repository.name,
          private: repository.private,
          defaultBranch: repository.defaultBranch,
          description: repository.description,
          integrationId: integrationByRepository.get(repository.id) ?? null,
        })),
      };
    }),

  connectRepository: sitesAccessProcedure
    .input(connectSiteRepositoryInputSchema)
    .handler(async ({ context, input }) => {
      const auth = await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      assertNotDemo();
      await runOrpcEffect(
        setSelectedGitHubAppRepositoriesEffect({
          organizationId: input.organizationId,
          userId: auth.user.id,
          repositoryIds: [input.githubRepositoryId],
          preserveExisting: true,
        }),
        toGitHubOperationOrpcError
      );
      const [repository] = await db
        .select({
          id: githubIntegrations.id,
          owner: githubIntegrations.owner,
          repo: githubIntegrations.repo,
          defaultBranch: githubIntegrations.defaultBranch,
          private: githubIntegrations.githubRepositoryPrivate,
        })
        .from(githubIntegrations)
        .where(
          and(
            eq(githubIntegrations.organizationId, input.organizationId),
            eq(githubIntegrations.githubRepositoryId, input.githubRepositoryId)
          )
        )
        .limit(1);
      if (!repository) {
        throw notFound("Repository not found");
      }
      return repository;
    }),

  repositorySuggestions: sitesProcedure
    .input(repositorySuggestionsInputSchema)
    .handler(async ({ input }) => {
      return await organizationRepositorySuggestions({
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
        ref: input.ref || null,
      });
    }),

  starterStatus: sitesProcedure
    .input(siteStarterInputSchema)
    .handler(async ({ input }) => {
      return await siteStarterStatus(input);
    }),

  createStarter: sitesProcedure
    .input(siteStarterInputSchema)
    .handler(async ({ input }) => {
      assertNotDemo();
      return await createSiteStarter(input);
    }),

  siteRepositorySuggestions: sitesProcedure
    .input(siteRepositorySuggestionsInputSchema)
    .handler(async ({ context, input }) => {
      const { site } = await requireSite(context, input);
      return await getRepositorySuggestions(
        await siteRepositoryAccess(site, { contents: "read" }),
        input.ref || null
      );
    }),

  get: sitesProcedure
    .input(siteScopeInputSchema)
    .handler(async ({ context, input }) => {
      const { site, canManageDeployments } = await requireSite(context, input);
      const [domains, state, draftCount] = await Promise.all([
        db.select().from(siteDomains).where(eq(siteDomains.siteId, site.id)),
        servingState(site.id),
        listPendingSiteDraftSummaries(site).then((drafts) => drafts.length),
      ]);
      const live = liveDeploymentsFromState(state);
      const deployments = await listSiteDeployments(
        site.id,
        SITE_DEPLOYMENTS_PAGE_LIMIT,
        [...live.keys()]
      );
      return {
        site: serializeSite(site, state),
        cnameTarget: siteCnameTarget(),
        domains: domains.map((domain) => serializeDomain(site, domain)),
        ...(await serializeDeploymentList(
          site,
          deployments,
          state,
          canManageDeployments
        )),
        previews: serializePreviews(site, state, deployments),
        draftCount,
      };
    }),

  repository: sitesProcedure
    .input(siteScopeInputSchema)
    .handler(async ({ context, input }) => {
      const { site } = await requireSite(context, input);
      return await getSiteRepositoryOverview(site).catch((error: unknown) => {
        console.warn("sites.repository_overview_failed", {
          siteId: site.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
    }),

  analytics: sitesProcedure
    .input(siteAnalyticsInputSchema)
    .handler(async ({ context, input }) => {
      const { site } = await requireSite(context, input);
      return runOrpcEffect(
        loadSiteAnalytics(site, geoWindow(input), input.path).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
    }),

  create: sitesProcedure
    .input(createSiteInputSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const access = await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      const result = await createSite({
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: access.user.id,
        name: input.name,
        slug: input.slug || undefined,
        repositoryId: input.repositoryId,
        productionBranch: input.productionBranch,
        rootDirectory: input.rootDirectory,
        mounts: input.mounts,
        previewVisibility: input.previewVisibility,
      });
      dispatchLater([result.jobId]);
      notifySitesCreated([result.site], access.user.email);
      return {
        site: serializeSite(result.site, null),
        deploymentQueued: Boolean(result.jobId),
      };
    }),

  createMany: sitesProcedure
    .input(createSitesInputSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const access = await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      if (!(await isSitesBulkImportEnabled(input.organizationId))) {
        throw forbidden("Bulk import is not enabled for this organization");
      }
      const results: CreateSitesResult[] = [];
      const jobIds: Array<string | null> = [];
      const createdSites: Site[] = [];
      for (const entry of input.sites) {
        try {
          const result = await createSite({
            organizationId: input.organizationId,
            projectId: input.projectId,
            userId: access.user.id,
            repositoryId: input.repositoryId,
            productionBranch: input.productionBranch,
            previewsEnabled: input.previewsEnabled,
            name: entry.name,
            slug: entry.slug || undefined,
            rootDirectory: entry.rootDirectory,
            mounts: entry.mounts,
          });
          jobIds.push(result.jobId);
          createdSites.push(result.site);
          results.push({
            rootDirectory: entry.rootDirectory ?? "",
            site: serializeSite(result.site, null),
            deploymentQueued: Boolean(result.jobId),
          });
        } catch (error) {
          results.push({
            rootDirectory: entry.rootDirectory ?? "",
            error: bulkImportErrorMessage(error),
          });
        }
      }
      dispatchLater(jobIds);
      notifySitesCreated(createdSites, access.user.email);
      return { results };
    }),

  update: sitesProcedure
    .input(updateSiteInputSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { site, userId } = await requireSite(context, input, {
        admin: true,
      });
      const {
        organizationId: _organizationId,
        siteId: _siteId,
        ...patch
      } = input;
      const result = await updateSiteSettings(site, patch, userId);
      dispatchLater([result.syncJobId]);
      return {
        site: serializeSite(result.site, await servingState(site.id)),
        rebuilding: result.rebuilding,
      };
    }),

  setSuspended: sitesProcedure
    .input(setSiteSuspendedInputSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { site } = await requireSite(context, input, { admin: true });
      await setSiteSuspended(site, input.suspended, { reason: input.reason });
      return { ok: true };
    }),

  delete: sitesProcedure
    .input(siteScopeInputSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { site } = await requireSite(context, input, { admin: true });
      await deleteSite(site);
      await purgeDeletedAnalytics({
        organizationId: site.organizationId,
        siteId: site.id,
      });
      return { ok: true };
    }),

  deployments: {
    list: sitesProcedure
      .input(listSiteDeploymentsInputSchema)
      .handler(async ({ context, input }) => {
        const { site, canManageDeployments } = await requireSite(
          context,
          input
        );
        const state = await servingState(site.id);
        const live = liveDeploymentsFromState(state);
        const deployments = await listSiteDeployments(site.id, input.limit, [
          ...live.keys(),
        ]);
        return (
          await serializeDeploymentList(
            site,
            deployments,
            state,
            canManageDeployments
          )
        ).deployments;
      }),

    get: sitesProcedure
      .input(siteDeploymentInputSchema)
      .handler(async ({ context, input }) => {
        const { site, canManageDeployments } = await requireSite(
          context,
          input
        );
        const deployment = await getDeployment(input.deploymentId);
        if (!deployment || deployment.siteId !== site.id) {
          throw notFound("Deployment not found");
        }
        const [log, state, telemetry] = await Promise.all([
          r2GetText(SITE_R2_KEYS.buildLog(site.id, deployment.id)).catch(
            () => null
          ),
          servingState(site.id),
          getBuildTelemetry(deployment.id),
        ]);
        const {
          deployments: [serializedDeployment],
        } = await serializeDeploymentList(
          site,
          [deployment],
          state,
          canManageDeployments
        );
        if (!serializedDeployment) {
          throw notFound("Deployment not found");
        }
        return {
          deployment: serializedDeployment,
          log:
            deployment.status === "building" ||
            deployment.status === "uploading"
              ? (log?.text ?? telemetry?.log ?? null)
              : (telemetry?.log ?? log?.text ?? null),
          metrics: telemetry?.metrics ?? null,
        };
      }),

    deployLatest: sitesProcedure
      .input(siteScopeInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        dispatchLater([
          await deployBranchHead(site, { trigger: "manual", userId }),
        ]);
        return { ok: true };
      }),

    redeploy: sitesProcedure
      .input(siteDeploymentInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId, canManageDeployments } = await requireSite(
          context,
          input
        );
        // Rebuilding production from before the live deployment is a
        // rollback, which is admin-only. Retrying newer builds stays open.
        if (!canManageDeployments && site.activeProductionDeploymentId) {
          const [target, active] = await Promise.all([
            getDeployment(input.deploymentId),
            getDeployment(site.activeProductionDeploymentId),
          ]);
          if (
            target?.kind === "production" &&
            active &&
            target.generation < active.generation
          ) {
            throw forbidden("Only owners and admins can do this");
          }
        }
        dispatchLater([await redeploy(site, input.deploymentId, userId)]);
        return { ok: true };
      }),

    promote: sitesProcedure
      .input(siteScopeInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input, { admin: true });
        await promoteLatestDeployment(site);
        return { ok: true };
      }),

    rollback: sitesProcedure
      .input(siteDeploymentInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input, { admin: true });
        await rollbackToDeployment(site, input.deploymentId);
        return { ok: true };
      }),
  },

  previews: {
    createForBranch: sitesProcedure
      .input(siteBranchPreviewInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        const result = await createBranchPreview(site, input.branch, userId);
        dispatchLater([result.jobId]);
        return {
          previewKey: result.previewKey,
          url: primaryMountUrl(
            sitePreviewOrigin(site.slug, result.previewKey),
            site.mounts
          ),
        };
      }),

    // Loaded with every post, so an organization without Sites gets no sites
    // instead of an error.
    sitesForPost: authorizedProcedure
      .input(postPreviewSitesInputSchema)
      .handler(async ({ context, input }) => {
        await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
        });
        if (!isSitesConfigured() || isDemoMode()) {
          return [];
        }
        return await listPostPreviewSites(input.organizationId, input.postId);
      }),

    createForPost: sitesProcedure
      .input(createPostPreviewInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        await assertActiveSubscription(input.organizationId);
        await assertPostPreviewRateLimit(input.organizationId);
        const result = await previewPostOnSite({
          site,
          postId: input.postId,
          userId,
          lifetime: input.lifetime,
          password: input.password,
        });
        dispatchLater([result.jobId]);
        return { previewKey: result.previewKey, pagePath: result.pagePath };
      }),

    updatePostAccess: sitesProcedure
      .input(updatePostPreviewAccessInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        const access = await updatePostPreviewAccess(
          site,
          postPreviewKey(input.postId, site.slug),
          { lifetime: input.lifetime, password: input.password }
        );
        return {
          expiresAt: access.expiresAt,
          hasPassword: access.password !== null,
        };
      }),

    postStatus: sitesProcedure
      .input(sitePostPreviewInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        return await postPreviewStatus(site, input.postId);
      }),

    delete: sitesProcedure
      .input(sitePreviewInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        dispatchLater([await deletePreview(site, input.previewKey)]);
        return { ok: true };
      }),

    accessUrl: sitesProcedure
      .input(sitePreviewAccessInputSchema)
      .handler(async ({ context, input }) => {
        const { site, userId } = await requireSite(context, input);
        const next =
          input.next ?? site.mounts.blog ?? site.mounts.changelog ?? "/";
        return await previewAccessUrl({
          site,
          previewKey: input.previewKey,
          next,
          kind: input.kind,
          userId,
        });
      }),

    setPassword: sitesProcedure
      .input(siteSetPreviewPasswordInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input, {
          admin: true,
        });
        const result = await setSitePreviewPassword(
          site,
          input.password,
          userId
        );
        dispatchLater([result.syncJobId]);
        return { passwordSet: input.password !== null };
      }),
  },

  domains: {
    add: sitesProcedure
      .input(addSiteDomainInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input, { admin: true });
        const domain = await addSiteDomain(site, {
          kind: input.kind,
          value: input.value,
        });
        return { id: domain.id };
      }),

    refresh: sitesProcedure
      .input(siteDomainInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input, {
          admin: true,
        });
        const result = await refreshSiteDomain(site, input.domainId, userId);
        dispatchLater([result.rebuildJobId]);
        if (result.newlyVerified) {
          notifyDomainConnected(site, result.domain.hostname);
        }
        return {
          status: result.domain.status,
          lastError: result.domain.lastError,
          rebuilding: Boolean(result.rebuildJobId),
        };
      }),

    connect: sitesProcedure
      .input(siteDomainInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input, { admin: true });
        return await dnsSetupForDomain({ site, domainId: input.domainId });
      }),

    remove: sitesProcedure
      .input(siteDomainInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input, {
          admin: true,
        });
        dispatchLater([
          await removeSiteDomain(
            site,
            input.domainId,
            siteAliasOrigin(site.slug),
            userId
          ),
        ]);
        return { ok: true };
      }),
  },

  branches: {
    list: sitesProcedure
      .input(siteBranchesListInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        return await listSiteBranches(site, input.search);
      }),
    status: sitesProcedure
      .input(siteEditorScopeInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        return await siteBranchStatus(site, input.branch);
      }),
    create: sitesProcedure
      .input(siteBranchCreateInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        return await createSiteBranch(site, { ...input, userId });
      }),
    rename: sitesProcedure
      .input(siteBranchRenameInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        return await renameSiteBranch(site, input.branch, input.title);
      }),
    delete: sitesProcedure
      .input(siteBranchInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        await deleteSiteBranch(site, input.branch);
        return { ok: true };
      }),
    discardDeletedDrafts: sitesProcedure
      .input(siteBranchInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        await discardDeletedSiteBranchDrafts(site, input.branch);
        return { ok: true };
      }),
    requestReview: sitesProcedure
      .input(siteBranchInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        await requestSiteBranchReview(site, input.branch);
        return { ok: true };
      }),
    mergeAndPublish: sitesProcedure
      .input(siteBranchInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        const result = await mergeSiteBranch(site, input.branch);
        const deployPending = await deployPublishedCommit(
          site,
          result.commitSha,
          userId
        );
        return { ...result, deployPending };
      }),
    flush: sitesProcedure
      .input(siteBranchFlushInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        if (input.branch === site.productionBranch) {
          throw new SiteInputError("Use Publish on the deployment branch");
        }
        return await flushSiteDrafts(site, {
          branch: input.branch,
          message: "Update site content",
          skipIfBusy: input.skipIfBusy,
          userId,
        });
      }),
  },

  editor: {
    files: sitesProcedure
      .input(siteEditorScopeInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        const [source, drafts] = await Promise.all([
          listSiteSourceFiles(site, input.branch),
          listPendingSiteDraftSummaries(site, input.branch),
        ]);
        const files = [...source.files];
        if (!files.some((file) => file.path === SITE_CONFIG_FILENAME)) {
          const content = defaultSiteConfigContent(site);
          files.push({
            path: SITE_CONFIG_FILENAME,
            sha: "",
            size: Buffer.byteLength(content),
          });
          files.sort((left, right) => left.path.localeCompare(right.path));
        }
        return {
          commitSha: source.commitSha,
          sourceContext: siteSourceContext(site),
          files,
          drafts: drafts.map((draft) => ({
            path: draft.path,
            id: draft.id,
            revision: draft.revision,
            deleted: draft.deleted,
            baseBlobSha: draft.baseBlobSha,
            updatedAt: draft.updatedAt,
          })),
        };
      }),

    read: sitesProcedure
      .input(siteFilePathInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        const [file, draft] = await Promise.all([
          readPublishedFile(site, input.path, input.branch),
          readSiteDraft(site, input.path, input.branch),
        ]);
        return {
          path: input.path,
          // Image drafts are base64; published images are only read by SHA.
          encoding: isSiteImageDraftPath(input.path)
            ? ("base64" as const)
            : ("utf8" as const),
          content:
            draft && !draft.deleted
              ? draft.content
              : (file?.content ??
                (input.path === SITE_CONFIG_FILENAME
                  ? defaultSiteConfigContent(site)
                  : "")),
          published: file?.content ?? null,
          blobSha: draft ? draft.baseBlobSha : (file?.sha ?? null),
          publishedBlobSha: file?.sha ?? null,
          hasDraft: Boolean(draft),
          draftId: draft?.id ?? null,
          draftRevision: draft?.revision ?? null,
          sourceContext: siteSourceContext(site),
        };
      }),

    saveDraft: sitesProcedure
      .input(saveSiteDraftInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        // Images only arrive through uploadImage, which sniffs and sanitizes them.
        if (isSiteImageDraftPath(input.path) && !input.deleted) {
          throw badRequest("Upload images instead of saving them as drafts");
        }
        const { site, userId } = await requireSite(context, input);
        const draft = await saveSiteDraft(site, {
          branch: input.branch,
          path: input.path,
          content: input.content,
          baseBlobSha: input.baseBlobSha,
          baseCommitSha: input.baseCommitSha,
          deleted: input.deleted,
          draftId: input.draftId,
          draftRevision: input.draftRevision,
          sourceContext: input.sourceContext,
          userId,
        });
        return {
          path: draft.path,
          updatedAt: draft.updatedAt,
          draftId: draft.id,
          draftRevision: draft.revision,
        };
      }),

    uploadImage: sitesProcedure
      .input(uploadSiteImageInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        let bytes: Uint8Array;
        try {
          bytes = await prepareSiteImage(
            Buffer.from(input.data, "base64"),
            input.kind
          );
        } catch (error) {
          if (error instanceof SvgSanitizationError) {
            const tErrors = await getTranslations("errors.upload");
            throw badRequest(tErrors("svgInvalid"));
          }
          if (error instanceof SiteImageInputError) {
            throw badRequest(error.message);
          }
          throw error;
        }
        const { path, draft } = await saveSiteImageDraft(site, {
          branch: input.branch,
          fileName: input.fileName,
          bytes,
          baseCommitSha: input.baseCommitSha,
          sourceContext: input.sourceContext,
          userId,
        });
        return {
          path,
          draft: draft
            ? {
                path: draft.path,
                updatedAt: draft.updatedAt,
                draftId: draft.id,
                draftRevision: draft.revision,
                deleted: draft.deleted,
                baseBlobSha: draft.baseBlobSha,
              }
            : null,
        };
      }),

    rebaseDraft: sitesProcedure
      .input(siteDraftMutationInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        return { rebased: Boolean(await rebaseSiteDraft(site, input, userId)) };
      }),

    discardDraft: sitesProcedure
      .input(siteDraftMutationInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site } = await requireSite(context, input);
        await discardSiteDraft(site, input);
        return { ok: true };
      }),

    validate: sitesProcedure
      .input(siteEditorScopeInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        const result = await validateSiteDrafts(site, input.branch);
        return { ok: result.ok, diagnostics: result.diagnostics };
      }),

    publish: sitesProcedure
      .input(publishSiteDraftsInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        const result = await publishSiteDrafts(site, {
          message: input.message,
          branch: input.branch,
          userId,
        });
        const deployPending = await deployPublishedCommit(
          site,
          result.commitSha,
          userId
        );
        return { ...result, deployPending };
      }),
  },

  integrations: {
    get: sitesProcedure
      .input(siteEditorScopeInputSchema)
      .handler(async ({ context, input }) => {
        const { site } = await requireSite(context, input);
        return await readSiteIntegrations(site, input.branch);
      }),

    save: sitesProcedure
      .input(saveSiteIntegrationInputSchema)
      .handler(async ({ context, input }) => {
        assertNotDemo();
        const { site, userId } = await requireSite(context, input);
        return await saveSiteIntegration(site, {
          ...input,
          userId,
        });
      }),

    inth: {
      status: sitesProcedure
        .input(siteEditorScopeInputSchema)
        .handler(async ({ context, input }) => {
          const { site } = await requireSite(context, input);
          return await getInthConsentStatus(site, input.branch);
        }),

      projects: sitesProcedure
        .input(siteScopeInputSchema)
        .handler(async ({ context, input }) => {
          const { site } = await requireSite(context, input);
          return await listInthProjects(site.organizationId);
        }),

      connect: sitesProcedure
        .input(connectSiteInthProjectInputSchema)
        .handler(async ({ context, input }) => {
          assertNotDemo();
          const { site, userId } = await requireSite(context, input, {
            admin: true,
          });
          return await connectSiteToInthProject(
            site,
            input.projectId,
            userId,
            input.branch
          );
        }),

      disconnect: sitesProcedure
        .input(siteScopeInputSchema)
        .handler(async ({ context, input }) => {
          assertNotDemo();
          const { site } = await requireSite(context, input, { admin: true });
          await disconnectInth(site.organizationId);
          return { disconnected: true };
        }),
    },
  },
};
