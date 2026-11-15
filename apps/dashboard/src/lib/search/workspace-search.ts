import { db } from "@notra/db/drizzle";
import {
  brandReferences,
  brandSettings,
  chatSessions,
  connectedSocialAccounts,
  geoCompetitors,
  geoPersonas,
  geoPrompts,
  githubIntegrations,
  linearIntegrations,
  posts,
  sites,
} from "@notra/db/schema";
import { projectScopedCollectionIds } from "@notra/db/utils/projects";
import { isDemoMode } from "@notra/utils/demo-mode";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { WORKSPACE_SEARCH_COLUMNS } from "@/constants/workspace-search";
import type { WorkspaceSearchParams } from "@/types/search";
import { workspaceSearchJsonRows } from "@/utils/workspace-search-json-rows";

const LIKE_ESCAPE_PATTERN = /[\\%_]/g;

function toLikePattern(input: string): string {
  return `%${input.replace(LIKE_ESCAPE_PATTERN, (char) => `\\${char}`)}%`;
}

/**
 * Substring search over the workspace entities the command palette can open.
 * GEO entities are project scoped and only searched when `projectId` is set.
 * Callers check organization access first.
 */
export async function searchWorkspace(params: WorkspaceSearchParams) {
  const pattern = toLikePattern(params.query);
  const orgFilter = eq(posts.organizationId, params.organizationId);
  const projectCollectionIds = projectScopedCollectionIds(
    params.organizationId,
    params.projectId
  );
  const postFilter = projectCollectionIds
    ? and(orgFilter, inArray(posts.collectionId, projectCollectionIds))
    : orgFilter;

  const { projectId } = params;
  const chatProjectFilter = projectId
    ? or(eq(chatSessions.projectId, projectId), isNull(chatSessions.projectId))
    : undefined;

  const [batchRows, siteRows] = await Promise.all([
    db
      .select({
        posts: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.posts)
            .from(posts)
            .where(
              and(
                postFilter,
                or(ilike(posts.title, pattern), ilike(posts.slug, pattern))
              )
            )
            .orderBy(desc(posts.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.posts
        ),
        voices: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.voices)
            .from(brandSettings)
            .where(
              and(
                eq(brandSettings.organizationId, params.organizationId),
                or(
                  ilike(brandSettings.name, pattern),
                  ilike(brandSettings.companyName, pattern),
                  ilike(brandSettings.websiteUrl, pattern)
                )
              )
            )
            .orderBy(desc(brandSettings.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.voices
        ),
        references: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.references)
            .from(brandReferences)
            .innerJoin(
              brandSettings,
              eq(brandReferences.brandSettingsId, brandSettings.id)
            )
            .where(
              and(
                eq(brandSettings.organizationId, params.organizationId),
                or(
                  ilike(brandReferences.content, pattern),
                  ilike(brandReferences.note, pattern)
                )
              )
            )
            .orderBy(desc(brandReferences.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.references
        ),
        githubIntegrations: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.githubIntegrations)
            .from(githubIntegrations)
            .where(
              and(
                eq(githubIntegrations.organizationId, params.organizationId),
                or(
                  ilike(githubIntegrations.displayName, pattern),
                  ilike(githubIntegrations.owner, pattern),
                  ilike(githubIntegrations.repo, pattern)
                )
              )
            )
            .orderBy(desc(githubIntegrations.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.githubIntegrations
        ),
        linearIntegrations: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.linearIntegrations)
            .from(linearIntegrations)
            .where(
              and(
                eq(linearIntegrations.organizationId, params.organizationId),
                or(
                  ilike(linearIntegrations.displayName, pattern),
                  ilike(linearIntegrations.linearOrganizationName, pattern),
                  ilike(linearIntegrations.linearTeamName, pattern)
                )
              )
            )
            .orderBy(desc(linearIntegrations.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.linearIntegrations
        ),
        socialAccounts: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.socialAccounts)
            .from(connectedSocialAccounts)
            .where(
              and(
                eq(
                  connectedSocialAccounts.organizationId,
                  params.organizationId
                ),
                or(
                  ilike(connectedSocialAccounts.username, pattern),
                  ilike(connectedSocialAccounts.displayName, pattern),
                  ilike(connectedSocialAccounts.provider, pattern)
                )
              )
            )
            .orderBy(desc(connectedSocialAccounts.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.socialAccounts
        ),
        prompts: workspaceSearchJsonRows(
          projectId
            ? db
                .select(WORKSPACE_SEARCH_COLUMNS.prompts)
                .from(geoPrompts)
                .where(
                  and(
                    eq(geoPrompts.organizationId, params.organizationId),
                    eq(geoPrompts.projectId, projectId),
                    or(
                      ilike(geoPrompts.prompt, pattern),
                      ilike(geoPrompts.title, pattern)
                    )
                  )
                )
                .orderBy(desc(geoPrompts.updatedAt))
                .limit(params.limit)
            : null,
          WORKSPACE_SEARCH_COLUMNS.prompts
        ),
        competitors: workspaceSearchJsonRows(
          projectId
            ? db
                .select(WORKSPACE_SEARCH_COLUMNS.competitors)
                .from(geoCompetitors)
                .where(
                  and(
                    eq(geoCompetitors.organizationId, params.organizationId),
                    eq(geoCompetitors.projectId, projectId),
                    or(
                      ilike(geoCompetitors.name, pattern),
                      ilike(geoCompetitors.domain, pattern)
                    )
                  )
                )
                .orderBy(desc(geoCompetitors.updatedAt))
                .limit(params.limit)
            : null,
          WORKSPACE_SEARCH_COLUMNS.competitors
        ),
        personas: workspaceSearchJsonRows(
          projectId
            ? db
                .select(WORKSPACE_SEARCH_COLUMNS.personas)
                .from(geoPersonas)
                .where(
                  and(
                    eq(geoPersonas.organizationId, params.organizationId),
                    eq(geoPersonas.projectId, projectId),
                    isNull(geoPersonas.archivedAt),
                    or(
                      ilike(geoPersonas.name, pattern),
                      ilike(geoPersonas.role, pattern),
                      ilike(geoPersonas.company, pattern)
                    )
                  )
                )
                .orderBy(desc(geoPersonas.updatedAt))
                .limit(params.limit)
            : null,
          WORKSPACE_SEARCH_COLUMNS.personas
        ),
        chats: workspaceSearchJsonRows(
          db
            .select(WORKSPACE_SEARCH_COLUMNS.chats)
            .from(chatSessions)
            .where(
              and(
                eq(chatSessions.organizationId, params.organizationId),
                isNull(chatSessions.deletedAt),
                isNull(chatSessions.contentId),
                chatProjectFilter,
                ilike(chatSessions.title, pattern)
              )
            )
            .orderBy(desc(chatSessions.updatedAt))
            .limit(params.limit),
          WORKSPACE_SEARCH_COLUMNS.chats
        ),
      })
      .from(sql`(select 1) as search_batch`),
    isDemoMode()
      ? []
      : db
          .select({
            id: sites.id,
            name: sites.name,
            publicOrigin: sites.publicOrigin,
          })
          .from(sites)
          .where(
            and(
              eq(sites.organizationId, params.organizationId),
              or(
                ilike(sites.name, pattern),
                ilike(sites.slug, pattern),
                ilike(sites.publicOrigin, pattern)
              )
            )
          )
          .orderBy(desc(sites.updatedAt))
          .limit(params.limit),
  ]);

  const batch = batchRows[0];
  if (!batch) {
    throw new Error("Workspace search returned no result row");
  }
  return { ...batch, sites: siteRows };
}
