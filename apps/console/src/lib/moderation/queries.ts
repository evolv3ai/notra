import "server-only";
import { db } from "@notra/db/drizzle";
import {
  abuseActions,
  members,
  organizations,
  sites,
  users,
} from "@notra/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  MODERATION_HISTORY_LIMIT,
  MODERATION_SEARCH_LIMIT,
} from "@/constants/moderation";
import type {
  ModerationAction,
  ModerationOrganization,
  ModerationUser,
  WorkspaceSiteCounts,
} from "@/types/moderation";
import { isUserBanned } from "@/utils/ban";
import { escapeLikePattern } from "@/utils/sql";

function pattern(search: string) {
  return search ? `%${escapeLikePattern(search)}%` : null;
}

/** Per-workspace site counts that tell whether its last action finished. */
const workspaceSiteCounts = {
  pendingRestoreCount: sql<number>`(select count(*)::int from ${sites} where ${sites.organizationId} = ${organizations.id} and ${sites.suspendedWithOrganization})`,
  activeSiteCount: sql<number>`(select count(*)::int from ${sites} where ${sites.organizationId} = ${organizations.id} and ${sites.status} = 'active')`,
};

export async function getWorkspaceSiteCounts(
  organizationId: string
): Promise<WorkspaceSiteCounts> {
  const [row] = await db
    .select(workspaceSiteCounts)
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row ?? { activeSiteCount: 0, pendingRestoreCount: 0 };
}

export async function searchOrganizations(
  search: string
): Promise<ModerationOrganization[]> {
  const like = pattern(search);
  return await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      suspendedAt: organizations.suspendedAt,
      suspendedReason: organizations.suspendedReason,
      siteCount: sql<number>`(select count(*)::int from ${sites} where ${sites.organizationId} = ${organizations.id})`,
      ...workspaceSiteCounts,
    })
    .from(organizations)
    .where(
      like
        ? or(
            ilike(organizations.name, like),
            ilike(organizations.slug, like),
            eq(organizations.id, search)
          )
        : undefined
    )
    .orderBy(
      sql`${organizations.suspendedAt} desc nulls last`,
      desc(organizations.createdAt)
    )
    .limit(MODERATION_SEARCH_LIMIT);
}

const moderationUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  banned: users.banned,
  banExpires: users.banExpires,
  banReason: users.banReason,
  ownedOrganizations: sql<number>`(select count(*)::int from ${members} where ${members.userId} = ${users.id} and ${members.role} = 'owner')`,
};

/** A ban that has expired no longer counts, as everywhere else. */
function toModerationUser({
  banned,
  banExpires,
  banReason,
  ...row
}: {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  banExpires: Date | null;
  banReason: string | null;
  ownedOrganizations: number;
}): ModerationUser {
  const active = isUserBanned({ banned, banExpires });
  return { ...row, banned: active, banReason: active ? banReason : null };
}

async function getModerationUser(
  userId: string
): Promise<ModerationUser | null> {
  const [row] = await db
    .select(moderationUserColumns)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toModerationUser(row) : null;
}

export async function searchUsers(search: string): Promise<ModerationUser[]> {
  const like = pattern(search);
  const rows = await db
    .select(moderationUserColumns)
    .from(users)
    .where(
      like
        ? or(
            ilike(users.name, like),
            ilike(users.email, like),
            eq(users.id, search)
          )
        : undefined
    )
    .orderBy(
      // Active bans first; an expired ban sorts with everyone else.
      sql`coalesce(${users.banned} and (${users.banExpires} is null or ${users.banExpires} > now()), false) desc`,
      desc(users.createdAt)
    )
    .limit(MODERATION_SEARCH_LIMIT);
  return rows.map(toModerationUser);
}

/**
 * The workspace owner a "Ban owner" action targets: the site's creator when
 * they own the workspace, otherwise its longest-standing owner.
 */
export async function getWorkspaceOwner(
  organizationId: string,
  preferredUserId: string | null
): Promise<ModerationUser | null> {
  const [owner] = await db
    .select({ userId: members.userId })
    .from(members)
    .where(
      and(eq(members.organizationId, organizationId), eq(members.role, "owner"))
    )
    .orderBy(
      sql`${members.userId} = ${preferredUserId ?? ""} desc`,
      members.createdAt
    )
    .limit(1);
  return owner ? await getModerationUser(owner.userId) : null;
}

export async function listOwnedOrganizationIds(
  userId: string
): Promise<string[]> {
  const rows = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.role, "owner")));
  return rows.map((row) => row.organizationId);
}

export async function listRecentAbuseActions(): Promise<ModerationAction[]> {
  const actor = alias(users, "actor");
  const subjectUser = alias(users, "subject_user");
  return await db
    .select({
      id: abuseActions.id,
      subjectType: abuseActions.subjectType,
      subjectId: abuseActions.subjectId,
      subjectLabel: sql<
        string | null
      >`coalesce(${sites.name}, ${organizations.name}, ${subjectUser.email})`,
      action: abuseActions.action,
      category: abuseActions.category,
      reason: abuseActions.reason,
      retry: abuseActions.retry,
      actorName: actor.name,
      createdAt: abuseActions.createdAt,
    })
    .from(abuseActions)
    .leftJoin(actor, eq(actor.id, abuseActions.actorUserId))
    .leftJoin(
      sites,
      and(
        eq(abuseActions.subjectType, "site"),
        eq(sites.id, abuseActions.subjectId)
      )
    )
    .leftJoin(
      organizations,
      and(
        eq(abuseActions.subjectType, "organization"),
        eq(organizations.id, abuseActions.subjectId)
      )
    )
    .leftJoin(
      subjectUser,
      and(
        eq(abuseActions.subjectType, "user"),
        eq(subjectUser.id, abuseActions.subjectId)
      )
    )
    .orderBy(desc(abuseActions.createdAt))
    .limit(MODERATION_HISTORY_LIMIT);
}
