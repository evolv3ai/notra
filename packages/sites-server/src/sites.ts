import { db } from "@notra/db/drizzle";
import {
  abuseActions,
  organizations,
  projects,
  siteDomains,
  siteBranchDrafts,
  siteDrafts,
  siteJobs,
  siteSlugGrants,
  sites,
} from "@notra/db/schema";
import {
  SITE_ABUSE_EMAIL,
  SITE_PREVIEW_PASSWORD_MAX_LENGTH,
  SITE_PREVIEW_PASSWORD_MIN_LENGTH,
} from "@notra/sites-core/constants/sites";
import type { SiteMounts } from "@notra/sites-core/types/deployment";
import {
  isAvailableSiteSlug,
  siteAliasHost,
  slugifySiteName,
} from "@notra/sites-core/utils/hosts";
import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";
import { hashPreviewPassword } from "@notra/sites-core/utils/preview-password";
import { and, desc, eq, inArray, sql, or, isNull } from "drizzle-orm";

import { deleteCustomHostnameQuietly } from "./cloudflare-saas";
import { SITE_NAME_REJECTION_MESSAGES } from "./constants/moderation";
import {
  DEFAULT_SITE_MOUNTS,
  SITE_SLUG_ATTEMPTS,
  SITE_SLUG_FALLBACK_MAX_LENGTH,
  SITE_SLUG_RETRY_ROOT_MAX_LENGTH,
  SITE_SLUG_RETIRED_NOTE,
  SITE_SLUG_RETRY_SUFFIX_LENGTH,
} from "./constants/sites";
import { deployBranchHead } from "./deploy";
import { getSitesHostingDomain } from "./env";
import { SiteInputError, SitePlanLimitError } from "./errors/sites";
import { assertSiteNameAllowed } from "./moderation";
import { assertSitePlanAllows, resolveSitePlan } from "./plan-limits";
import { r2DeletePrefix } from "./r2";
import { requireOrganizationRepository } from "./repositories";
import {
  claimHostRecord,
  mutateServingState,
  releaseHostRecord,
  setServingStatus,
} from "./state";
import type { SiteStorageTransaction } from "./types/deployments";
import type {
  CreateSiteInput,
  CreateSiteResult,
  SetOrganizationSuspendedInput,
  SetOrganizationSuspendedResult,
  SetSiteSuspendedOptions,
  SiteTransitionResult,
  Site,
  SiteSettingsPatch,
  SiteUpdateValues,
  UpdateSiteSettingsResult,
} from "./types/sites";
import { errorMessage } from "./utils/errors";
import { prefixedId } from "./utils/ids";
import { invalidateSiteIngestCaches } from "./utils/ingest-cache";
import { parseRootDirectory } from "./utils/root-directory";
import { acquireSiteHostLock, withSiteHostLock } from "./utils/site-host-lock";
import { siteAliasOrigin } from "./utils/urls";

function siteAliasHostname(slug: string): string {
  return siteAliasHost(slug, getSitesHostingDomain());
}

function parseMounts(mounts: SiteMounts): SiteMounts {
  try {
    return normalizeSiteMounts(mounts);
  } catch (error) {
    throw new SiteInputError(errorMessage(error), { field: "sections" });
  }
}

async function uniqueSlug(
  base: string,
  organizationId: string
): Promise<string> {
  const root = isAvailableSiteSlug(base)
    ? base
    : `site-${base}`.slice(0, SITE_SLUG_FALLBACK_MAX_LENGTH).replace(/-$/, "");
  for (let attempt = 0; attempt < SITE_SLUG_ATTEMPTS; attempt += 1) {
    const candidate =
      attempt === 0
        ? root
        : `${root.slice(0, SITE_SLUG_RETRY_ROOT_MAX_LENGTH)}-${Math.random()
            .toString(36)
            .slice(2, 2 + SITE_SLUG_RETRY_SUFFIX_LENGTH)}`;
    if (!isAvailableSiteSlug(candidate)) {
      continue;
    }
    const [taken] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.slug, candidate))
      .limit(1);
    if (!(taken || (await isSlugHeldForOther(candidate, organizationId)))) {
      return candidate;
    }
  }
  throw new SiteInputError(
    "Could not find a free site address; pick a different name",
    { field: "name" }
  );
}

async function isSlugHeldForOther(
  slug: string,
  organizationId: string,
  executor: SiteStorageTransaction | typeof db = db
): Promise<boolean> {
  const [grant] = await executor
    .select({ organizationId: siteSlugGrants.organizationId })
    .from(siteSlugGrants)
    .where(eq(siteSlugGrants.slug, slug))
    .limit(1);
  return grant !== undefined && grant.organizationId !== organizationId;
}

/**
 * Rejects work for a workspace Notra suspended. Inside a transaction the share
 * lock, taken before any host lock, makes a concurrent workspace suspension
 * wait for the caller to commit, so a site created meanwhile is taken down too.
 */
async function assertWorkspaceNotSuspended(
  organizationId: string,
  executor: Pick<typeof db, "select">
): Promise<void> {
  const [organization] = await executor
    .select({ suspendedAt: organizations.suspendedAt })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for("share");
  if (organization?.suspendedAt) {
    throw new SiteInputError(
      `Notra suspended this workspace. Contact ${SITE_ABUSE_EMAIL} to restore it.`
    );
  }
}

export async function createSite(
  input: CreateSiteInput
): Promise<CreateSiteResult> {
  await assertWorkspaceNotSuspended(input.organizationId, db);
  const project = input.projectId
    ? await db.query.projects.findFirst({
        columns: { id: true },
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.organizationId, input.organizationId)
        ),
      })
    : undefined;
  if (!project) {
    throw new SiteInputError("Project not found in this organization");
  }
  const { integration, repository } = await requireOrganizationRepository(
    input.organizationId,
    input.repositoryId
  );
  if (!integration.githubRepositoryId) {
    throw new SiteInputError(
      "Connect the repository through the Notra GitHub App first",
      { field: "repository" }
    );
  }
  const rootDirectory = parseRootDirectory(input.rootDirectory ?? "");
  const mounts = parseMounts(input.mounts ?? DEFAULT_SITE_MOUNTS);
  const requestedSlug = input.slug?.trim().toLowerCase();
  if (requestedSlug && !isAvailableSiteSlug(requestedSlug)) {
    throw new SiteInputError(
      "Use 3-40 lowercase letters, digits and single dashes for the address",
      { field: "slug" }
    );
  }
  const slug =
    requestedSlug ??
    (await uniqueSlug(
      slugifySiteName(input.name) || "site",
      input.organizationId
    ));
  const plan = await resolveSitePlan(input.organizationId);
  const siteId = prefixedId("site");
  const aliasHost = siteAliasHostname(slug);
  await assertSiteNameAllowed({
    organizationId: input.organizationId,
    userId: input.userId,
    name: input.name,
    address: aliasHost,
    slug,
  });

  let site: Site | undefined;
  try {
    // Deletion retires the slug while holding this lock, so the grant is
    // rechecked under it before the alias is claimed.
    site = await db.transaction(async (outer) => {
      await assertWorkspaceNotSuspended(input.organizationId, outer);
      return await withSiteHostLock(
        aliasHost,
        async (tx) => {
          if (await isSlugHeldForOther(slug, input.organizationId, tx)) {
            throw new SiteInputError(SITE_NAME_REJECTION_MESSAGES.granted, {
              field: "slug",
            });
          }
          await assertSitePlanAllows(tx, input.organizationId, plan, "sites");
          await claimHostRecord(aliasHost, { siteId, kind: "alias" });
          const [inserted] = await tx
            .insert(sites)
            .values({
              id: siteId,
              organizationId: input.organizationId,
              projectId: project.id,
              name: input.name.trim(),
              slug,
              repositoryId: integration.id,
              githubInstallationId: repository.installationId,
              githubRepositoryId: integration.githubRepositoryId,
              repositoryOwner: repository.owner,
              repositoryName: repository.repo,
              productionBranch:
                input.productionBranch?.trim() ||
                integration.defaultBranch ||
                "main",
              rootDirectory,
              publicOrigin: siteAliasOrigin(slug),
              mounts,
              previewVisibility: input.previewVisibility ?? "protected",
              previewsEnabled: input.previewsEnabled ?? true,
              createdByUserId: input.userId,
            })
            .returning();
          return inserted;
        },
        { tx: outer }
      );
    });
  } catch (error) {
    await releaseHostRecord(aliasHost, siteId);
    throw error;
  }
  if (!site) {
    throw new Error("Could not create site");
  }
  await invalidateSiteIngestCaches(site);
  await mutateServingState(site, (state) => ({
    write: state,
    result: undefined,
  })).catch((error: unknown) => {
    console.warn("sites.initial_serving_state_failed", errorMessage(error));
  });
  const jobId = await deployBranchHead(site, {
    trigger: "manual",
    userId: input.userId,
  }).catch((error: unknown) => {
    console.warn("sites.initial_deploy_failed", errorMessage(error));
    return null;
  });
  return { site, jobId };
}

/**
 * Moves one site in or out of suspension inside the caller's transaction. The
 * workspace row is locked before the site row, the same order workspace
 * actions and deletion use, so a workspace action and a site change never
 * interleave. Repeating an action the site is already in changes nothing and
 * is audited as a retry, keyed to the original suspension for its notice.
 */
async function transitionSite(
  tx: SiteStorageTransaction,
  site: Site,
  suspended: boolean,
  {
    by = "owner",
    reason,
    category,
    actorUserId = null,
    withOrganization = false,
  }: SetSiteSuspendedOptions
): Promise<SiteTransitionResult> {
  const [organization] = await tx
    .select({ suspendedAt: organizations.suspendedAt })
    .from(organizations)
    .where(eq(organizations.id, site.organizationId))
    .for("share");
  // Re-read under lock so an owner request can't overwrite a Notra
  // suspension that landed after the caller loaded the site.
  const [current] = await tx
    .select({
      status: sites.status,
      suspendedBy: sites.suspendedBy,
      suspendedWithOrganization: sites.suspendedWithOrganization,
    })
    .from(sites)
    .where(eq(sites.id, site.id))
    .for("update");
  if (!current) {
    throw new SiteInputError("Site not found");
  }
  // A workspace change only touches sites still in the state it selected,
  // so it never adopts or lifts a takedown made on its own.
  if (
    withOrganization &&
    (suspended
      ? current.status !== "active"
      : !current.suspendedWithOrganization)
  ) {
    return { changed: false, retry: false, notice: null };
  }
  const retry = suspended
    ? current.status === "suspended" &&
      current.suspendedBy === by &&
      current.suspendedWithOrganization === withOrganization
    : current.status === "active";
  // The workspace comes first, so a site taken down with it names the
  // workspace as the reason it can't come back.
  if (!(suspended || retry) && organization?.suspendedAt) {
    throw new SiteInputError(
      by === "owner"
        ? `Notra suspended this workspace. Contact ${SITE_ABUSE_EMAIL} to restore it.`
        : "Lift the workspace suspension first"
    );
  }
  if (by === "owner" && current.suspendedBy === "notra") {
    throw new SiteInputError(
      `Notra suspended this site. Contact ${SITE_ABUSE_EMAIL} to restore it.`
    );
  }
  const notice = suspended && by === "notra" && category ? { category } : null;
  if (!retry) {
    const status = suspended ? "suspended" : "active";
    await setServingStatus(site, status, tx, notice);
    await tx
      .update(sites)
      .set({
        status,
        suspendedReason: suspended ? (reason ?? null) : null,
        suspendedBy: suspended ? by : null,
        suspendedWithOrganization: suspended && withOrganization,
      })
      .where(eq(sites.id, site.id));
  }
  // Owner pauses aren't moderation, so only Notra actions are audited.
  if (by === "owner") {
    return { changed: !retry, retry, notice: null };
  }
  // A repeated suspension keeps the original category, reason and notice key.
  const [original] =
    suspended && retry
      ? await tx
          .select({
            id: abuseActions.id,
            category: abuseActions.category,
            reason: abuseActions.reason,
          })
          .from(abuseActions)
          .where(
            and(
              eq(abuseActions.subjectType, "site"),
              eq(abuseActions.subjectId, site.id),
              eq(abuseActions.action, "suspend"),
              eq(abuseActions.retry, false)
            )
          )
          .orderBy(desc(abuseActions.createdAt))
          .limit(1)
      : [];
  const actionId = prefixedId("abuse");
  const noticeCategory = original
    ? original.category
    : (notice?.category ?? null);
  await tx.insert(abuseActions).values({
    id: actionId,
    subjectType: "site",
    subjectId: site.id,
    action: suspended ? "suspend" : "unsuspend",
    category: noticeCategory,
    reason: reason ?? null,
    retry,
    actorUserId,
  });
  return {
    changed: !retry,
    retry,
    notice:
      suspended && noticeCategory
        ? {
            key: original?.id ?? actionId,
            category: noticeCategory,
            reason: (original ? original.reason : reason) ?? "",
          }
        : null,
  };
}

export async function setSiteSuspended(
  site: Site,
  suspended: boolean,
  options: SetSiteSuspendedOptions = {}
): Promise<SiteTransitionResult> {
  const result = await db.transaction((tx) =>
    transitionSite(tx, site, suspended, options)
  );
  if (result.changed) {
    await invalidateSiteIngestCaches(site);
  }
  return result;
}

/**
 * Suspends or lifts a workspace with every site it covers: suspending takes
 * its active sites offline and blocks new sites, builds and API keys;
 * lifting restores only the sites the suspension took down. The whole action
 * holds the workspace row, so overlapping workspace and site changes apply in
 * order. A site that fails is rolled back on its own and counted. Repeating
 * the action the workspace is already in is a retry: it keeps the original
 * time, reason and notice key and only finishes the sites left over.
 */
export async function setOrganizationSuspended(
  input: SetOrganizationSuspendedInput
): Promise<SetOrganizationSuspendedResult> {
  const { organizationId, suspended, reason, actorUserId } = input;
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        suspendedAt: organizations.suspendedAt,
        suspendedReason: organizations.suspendedReason,
        suspendedCategory: organizations.suspendedCategory,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for("update");
    if (!current) {
      throw new SiteInputError("Organization not found");
    }
    const retry = suspended === (current.suspendedAt !== null);
    const category = retry
      ? (current.suspendedCategory ?? undefined)
      : input.category;
    if (suspended && !category) {
      throw new SiteInputError("A suspension needs a category");
    }
    const suspendedAt = suspended ? (current.suspendedAt ?? new Date()) : null;
    if (!retry) {
      await tx
        .update(organizations)
        .set({
          suspendedAt,
          suspendedReason: suspended ? reason : null,
          suspendedCategory: suspended ? (category ?? null) : null,
        })
        .where(eq(organizations.id, organizationId));
    }
    await tx.insert(abuseActions).values({
      id: prefixedId("abuse"),
      subjectType: "organization",
      subjectId: organizationId,
      action: suspended ? "suspend" : "unsuspend",
      category: suspended ? (category ?? null) : null,
      reason,
      retry,
      actorUserId,
    });
    const affected = await tx
      .select()
      .from(sites)
      .where(
        and(
          eq(sites.organizationId, organizationId),
          suspended
            ? eq(sites.status, "active")
            : eq(sites.suspendedWithOrganization, true)
        )
      );
    const changed: Site[] = [];
    let failed = 0;
    for (const site of affected) {
      try {
        const transition = await tx.transaction((savepoint) =>
          transitionSite(savepoint, site, suspended, {
            by: "notra",
            reason,
            category,
            actorUserId,
            withOrganization: true,
          })
        );
        if (transition.changed) {
          changed.push(site);
        }
      } catch (error) {
        failed += 1;
        console.error("sites.organization_suspension_site_failed", {
          siteId: site.id,
          error: errorMessage(error),
        });
      }
    }
    const notice =
      suspendedAt && category
        ? {
            key: `organization:${organizationId}:${suspendedAt.toISOString()}`,
            category,
            reason: retry ? (current.suspendedReason ?? reason) : reason,
            siteNames: (
              await tx
                .select({ name: sites.name })
                .from(sites)
                .where(
                  and(
                    eq(sites.organizationId, organizationId),
                    eq(sites.suspendedWithOrganization, true)
                  )
                )
            ).map((row) => row.name),
          }
        : null;
    return {
      organization: { id: current.id, name: current.name, slug: current.slug },
      retry,
      sites: changed,
      failed,
      notice,
    };
  });
  await Promise.all(
    result.sites.map((site) => invalidateSiteIngestCaches(site))
  );
  return result;
}

export async function updateSiteSettings(
  site: Site,
  patch: SiteSettingsPatch,
  userId: string | null
): Promise<UpdateSiteSettingsResult> {
  if (
    patch.previewPassword !== undefined &&
    patch.previewPassword !== null &&
    (patch.previewPassword.length < SITE_PREVIEW_PASSWORD_MIN_LENGTH ||
      patch.previewPassword.length > SITE_PREVIEW_PASSWORD_MAX_LENGTH)
  ) {
    throw new SiteInputError(
      `The password needs ${SITE_PREVIEW_PASSWORD_MIN_LENGTH} to ${SITE_PREVIEW_PASSWORD_MAX_LENGTH} characters`
    );
  }
  if (
    patch.showBranding === false &&
    (await resolveSitePlan(site.organizationId)) === "free"
  ) {
    throw new SitePlanLimitError("branding");
  }
  const values: SiteUpdateValues = {
    productionBranch: patch.productionBranch?.trim(),
    rootDirectory:
      patch.rootDirectory === undefined
        ? undefined
        : parseRootDirectory(patch.rootDirectory),
    mounts: patch.mounts ? parseMounts(patch.mounts) : undefined,
    previewsEnabled: patch.previewsEnabled,
    smartDeployments: patch.smartDeployments,
    previewCommentsEnabled: patch.previewCommentsEnabled,
    previewVisibility: patch.previewVisibility,
    showBranding: patch.showBranding,
    analyticsEnabled: patch.analyticsEnabled,
    publicOrigin:
      patch.publicOrigin === undefined
        ? undefined
        : new URL(patch.publicOrigin).origin,
  };
  if (patch.previewPassword !== undefined) {
    values.previewPassword =
      patch.previewPassword === null
        ? null
        : await hashPreviewPassword(patch.previewPassword);
  }
  if (
    patch.repositoryId !== undefined &&
    patch.repositoryId !== site.repositoryId
  ) {
    const { integration, repository } = await requireOrganizationRepository(
      site.organizationId,
      patch.repositoryId
    );
    values.repositoryId = integration.id;
    values.githubInstallationId = repository.installationId;
    values.githubRepositoryId = repository.githubRepositoryId;
    values.repositoryOwner = repository.owner;
    values.repositoryName = repository.repo;
    values.productionBranch ??= integration.defaultBranch || "main";
  }
  const name = patch.name?.trim();
  if (name !== undefined && name !== site.name) {
    if (userId === null) {
      throw new SiteInputError("A user is required to change the site name");
    }
    await assertSiteNameAllowed({
      organizationId: site.organizationId,
      userId,
      name,
      address: siteAliasHostname(site.slug),
    });
    values.name = name;
  }
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(sites)
      .where(eq(sites.id, site.id))
      .for("update");
    if (!current) {
      throw new SiteInputError("Site not found");
    }
    const changingBranch =
      values.productionBranch !== undefined &&
      values.productionBranch !== current.productionBranch;
    const repositoryChanged =
      values.githubRepositoryId !== undefined &&
      (values.githubRepositoryId !== current.githubRepositoryId ||
        values.repositoryOwner !== current.repositoryOwner ||
        values.repositoryName !== current.repositoryName);
    // A new repository or root directory invalidates drafts on every branch.
    const changingRoot =
      repositoryChanged ||
      (values.rootDirectory !== undefined &&
        values.rootDirectory !== current.rootDirectory);
    if (changingBranch || changingRoot) {
      const affectedBranches = [
        current.productionBranch,
        values.productionBranch ?? current.productionBranch,
      ];
      const [draft] = await tx
        .select({ id: siteDrafts.id })
        .from(siteDrafts)
        .where(
          and(
            eq(siteDrafts.siteId, current.id),
            // Changing root directories invalidates drafts on every branch.
            changingRoot
              ? undefined
              : inArray(siteDrafts.branch, affectedBranches),
            or(
              isNull(siteDrafts.committedRevision),
              sql`${siteDrafts.revision} > ${siteDrafts.committedRevision}`
            )
          )
        )
        .limit(1);
      const featureDrafts = await tx
        .select({ id: siteBranchDrafts.id })
        .from(siteBranchDrafts)
        .where(
          and(
            eq(siteBranchDrafts.siteId, current.id),
            changingRoot
              ? undefined
              : inArray(siteBranchDrafts.branch, affectedBranches),
            or(
              isNull(siteBranchDrafts.committedRevision),
              sql`${siteBranchDrafts.revision} > ${siteBranchDrafts.committedRevision}`
            )
          )
        )
        .limit(1);
      if (draft || featureDrafts.length) {
        throw new SiteInputError(
          "Publish or discard this site's drafts before changing its repository, branch or root directory"
        );
      }
    }
    // Previews belong to the old repository's branches and pull requests.
    const removePreviewsThrough =
      repositoryChanged ||
      (current.previewsEnabled && values.previewsEnabled === false)
        ? current.lastGeneration + 1
        : null;
    const rebuilding = Boolean(
      repositoryChanged ||
      (values.mounts &&
        JSON.stringify(values.mounts) !== JSON.stringify(current.mounts)) ||
      (values.productionBranch &&
        values.productionBranch !== current.productionBranch) ||
      (values.rootDirectory !== undefined &&
        values.rootDirectory !== current.rootDirectory) ||
      (values.showBranding !== undefined &&
        values.showBranding !== current.showBranding) ||
      (values.publicOrigin !== undefined &&
        values.publicOrigin !== current.publicOrigin)
    );
    const [updated] = Object.values(values).some((value) => value !== undefined)
      ? await tx
          .update(sites)
          .set({
            ...values,
            ...(removePreviewsThrough === null
              ? {}
              : { lastGeneration: removePreviewsThrough }),
          })
          .where(eq(sites.id, site.id))
          .returning()
      : [current];
    if (!updated) {
      throw new SiteInputError("Site not found");
    }
    const syncJobId = prefixedId("job");
    await tx.insert(siteJobs).values({
      id: syncJobId,
      siteId: updated.id,
      kind: "sync_state",
      payload: {
        rebuild: rebuilding,
        removePreviewsThrough,
        requestedByUserId: userId,
      },
    });
    return { site: updated, syncJobId, rebuilding };
  });
  await invalidateSiteIngestCaches(site);
  return result;
}

export async function setSitePublicOrigin(
  site: Site,
  origin: string,
  userId: string | null
): Promise<string> {
  const { syncJobId } = await updateSiteSettings(
    site,
    { publicOrigin: origin },
    userId
  );
  return syncJobId;
}

export async function deleteSite(
  site: Site,
  tx?: SiteStorageTransaction
): Promise<void> {
  if (!tx) {
    await db.transaction(async (locked) => {
      await locked
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, site.organizationId))
        .for("update");
      const [current] = await locked
        .select()
        .from(sites)
        .where(
          and(
            eq(sites.id, site.id),
            eq(sites.organizationId, site.organizationId)
          )
        )
        .limit(1);
      if (!current) {
        throw new SiteInputError("Site not found");
      }
      const domains = await locked
        .select({ hostname: siteDomains.hostname })
        .from(siteDomains)
        .where(eq(siteDomains.siteId, site.id));
      const hostnames = new Set([
        siteAliasHostname(current.slug),
        ...domains.map((domain) => domain.hostname),
      ]);
      for (const hostname of [...hostnames].sort()) {
        await acquireSiteHostLock(locked, hostname);
      }
      await deleteSite(current, locked);
    });
    return;
  }
  await setServingStatus(site, "suspended", tx);
  const subdomains = await tx
    .select({
      hostname: siteDomains.hostname,
      cloudflareHostnameId: siteDomains.cloudflareHostnameId,
    })
    .from(siteDomains)
    .where(
      and(eq(siteDomains.siteId, site.id), eq(siteDomains.kind, "subdomain"))
    );
  // Proxies elsewhere may still point at the alias, so the slug stays with
  // this organization; a Notra suspension keeps it blocked for everyone.
  // Locked reread: a Notra suspension committed after the caller's read must
  // still block the slug for everyone.
  const [lockedSite] = await tx
    .select({ suspendedBy: sites.suspendedBy })
    .from(sites)
    .where(eq(sites.id, site.id))
    .for("update");
  const slugOwner =
    lockedSite?.suspendedBy === "notra" ? null : site.organizationId;
  const retiredSlug = tx.insert(siteSlugGrants).values({
    slug: site.slug,
    organizationId: slugOwner,
    note: SITE_SLUG_RETIRED_NOTE,
  });
  await (slugOwner === null
    ? retiredSlug.onConflictDoUpdate({
        target: siteSlugGrants.slug,
        set: { organizationId: null },
      })
    : retiredSlug.onConflictDoNothing({ target: siteSlugGrants.slug }));
  await releaseHostRecord(siteAliasHostname(site.slug), site.id, tx);
  for (const domain of subdomains) {
    await releaseHostRecord(domain.hostname, site.id, tx);
    await deleteCustomHostnameQuietly(domain.cloudflareHostnameId);
  }
  await tx.delete(sites).where(eq(sites.id, site.id));
  await invalidateSiteIngestCaches(site);
  await Promise.all(
    ["deployments", "logs", "previews", "sites"].map((root) =>
      r2DeletePrefix(`${root}/${site.id}/`)
    )
  );
}
