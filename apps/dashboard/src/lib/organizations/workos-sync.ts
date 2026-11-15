import { db } from "@notra/db/drizzle";
import { members, organizations, users } from "@notra/db/schema";
import { isDemoMode } from "@notra/utils/demo-mode";
import { getWorkOS } from "@workos/authkit-session";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { WorkOSSyncError } from "@/lib/organizations/errors";

const logSyncFailure = (context: Record<string, unknown>) =>
  Effect.catch((error: WorkOSSyncError) =>
    Effect.logWarning("WorkOS sync failed").pipe(
      Effect.annotateLogs({ ...context, error: error.message })
    )
  );

const skipInDemo = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A | void, E, R> =>
  Effect.suspend(() => (isDemoMode() ? Effect.void : effect));

async function findWorkOSIds(organizationId: string, userId: string) {
  const [organization, user] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { workosOrgId: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { workosUserId: true },
    }),
  ]);

  if (!(organization?.workosOrgId && user?.workosUserId)) {
    return null;
  }
  return {
    workosOrgId: organization.workosOrgId,
    workosUserId: user.workosUserId,
  };
}

const ensureWorkOSOrganization = Effect.fn(
  "organizations.sync.ensureWorkOSOrganization"
)(function* (organizationId: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const organization = await db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
        columns: { name: true, workosOrgId: true },
      });

      if (!organization) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      if (organization.workosOrgId) {
        return { workosOrgId: organization.workosOrgId, healed: false };
      }

      let workosOrgId: string;
      try {
        const created = await getWorkOS().organizations.createOrganization({
          name: organization.name,
          externalId: organizationId,
        });
        workosOrgId = created.id;
      } catch (createError) {
        try {
          const existing =
            await getWorkOS().organizations.getOrganizationByExternalId(
              organizationId
            );
          workosOrgId = existing.id;
        } catch {
          throw createError;
        }
      }

      await db
        .update(organizations)
        .set({ workosOrgId })
        .where(eq(organizations.id, organizationId));

      return { workosOrgId, healed: true };
    },
    catch: (cause) =>
      new WorkOSSyncError({
        message: "Failed to link organization to WorkOS",
        cause,
      }),
  });
});

export const syncOrganizationNameToWorkOS = Effect.fn(
  "organizations.sync.syncOrganizationName"
)(function* (organizationId: string, name: string) {
  yield* Effect.gen(function* () {
    const { workosOrgId } = yield* ensureWorkOSOrganization(organizationId);

    yield* Effect.tryPromise({
      try: () =>
        getWorkOS().organizations.updateOrganization({
          organization: workosOrgId,
          name,
        }),
      catch: (cause) =>
        new WorkOSSyncError({
          message: "Failed to sync organization name to WorkOS",
          cause,
        }),
    });
  }).pipe(logSyncFailure({ organizationId }), skipInDemo);
});

export const ensureWorkOSOrganizationWithMembers = Effect.fn(
  "organizations.sync.ensureWorkOSOrganizationWithMembers"
)(function* (organizationId: string) {
  const result = yield* ensureWorkOSOrganization(organizationId);

  if (result.healed) {
    yield* syncAllMembershipsToWorkOS(organizationId);
  }

  return result.workosOrgId;
});

const syncAllMembershipsToWorkOS = Effect.fn(
  "organizations.sync.syncAllMemberships"
)(function* (organizationId: string) {
  const rows = yield* Effect.tryPromise({
    try: () =>
      db.query.members.findMany({
        where: eq(members.organizationId, organizationId),
        columns: { userId: true, role: true },
      }),
    catch: (cause) =>
      new WorkOSSyncError({ message: "Failed to load members", cause }),
  });

  for (const row of rows) {
    yield* createWorkOSMembership(organizationId, row.userId, row.role);
  }
});

const createWorkOSMembership = Effect.fn(
  "organizations.sync.createWorkOSMembership"
)(function* (organizationId: string, userId: string, roleSlug?: string) {
  yield* Effect.tryPromise({
    try: async () => {
      const ids = await findWorkOSIds(organizationId, userId);
      if (!ids) {
        return;
      }

      try {
        await getWorkOS().userManagement.createOrganizationMembership({
          organizationId: ids.workosOrgId,
          userId: ids.workosUserId,
          roleSlug,
        });
      } catch (createError) {
        const existing =
          await getWorkOS().userManagement.listOrganizationMemberships({
            organizationId: ids.workosOrgId,
            userId: ids.workosUserId,
          });

        if (existing.data.length === 0) {
          throw createError;
        }
      }
    },
    catch: (cause) =>
      new WorkOSSyncError({
        message: "Failed to create WorkOS membership",
        cause,
      }),
  });
});

/** Fails instead of logging; see removeMembershipFromWorkOSStrict. */
export const updateMembershipRoleInWorkOSStrict = Effect.fn(
  "organizations.sync.updateWorkOSMembershipRoleStrict"
)(function* (organizationId: string, userId: string, roleSlug: string) {
  yield* Effect.tryPromise({
    try: async () => {
      const ids = await findWorkOSIds(organizationId, userId);
      if (!ids) {
        return;
      }

      const memberships =
        await getWorkOS().userManagement.listOrganizationMemberships({
          organizationId: ids.workosOrgId,
          userId: ids.workosUserId,
        });

      const membership = memberships.data[0];

      if (membership) {
        await getWorkOS().userManagement.updateOrganizationMembership(
          membership.id,
          { roleSlug }
        );
        return;
      }

      await getWorkOS().userManagement.createOrganizationMembership({
        organizationId: ids.workosOrgId,
        userId: ids.workosUserId,
        roleSlug,
      });
    },
    catch: (cause) =>
      new WorkOSSyncError({
        message: "Failed to update WorkOS membership role",
        cause,
      }),
  }).pipe(skipInDemo);
});

export const updateMembershipRoleInWorkOS = Effect.fn(
  "organizations.sync.updateWorkOSMembershipRole"
)(function* (organizationId: string, userId: string, roleSlug: string) {
  yield* updateMembershipRoleInWorkOSStrict(
    organizationId,
    userId,
    roleSlug
  ).pipe(logSyncFailure({ organizationId, userId }));
});

export const deleteOrganizationFromWorkOS = Effect.fn(
  "organizations.sync.deleteWorkOSOrganization"
)(function* (workosOrgId: string | null) {
  if (!workosOrgId) {
    return;
  }

  yield* Effect.tryPromise({
    try: () => getWorkOS().organizations.deleteOrganization(workosOrgId),
    catch: (cause) =>
      new WorkOSSyncError({
        message: "Failed to delete WorkOS organization",
        cause,
      }),
  }).pipe(logSyncFailure({ workosOrgId }), skipInDemo);
});

/**
 * Fails instead of logging so access revocations can run remote-first: a local
 * removal that WorkOS never saw would be restored by the next login sync.
 */
export const removeMembershipFromWorkOSStrict = Effect.fn(
  "organizations.sync.removeWorkOSMembershipStrict"
)(function* (organizationId: string, userId: string) {
  yield* Effect.tryPromise({
    try: async () => {
      const ids = await findWorkOSIds(organizationId, userId);
      if (!ids) {
        return;
      }

      const memberships =
        await getWorkOS().userManagement.listOrganizationMemberships({
          organizationId: ids.workosOrgId,
          userId: ids.workosUserId,
        });

      await Promise.all(
        memberships.data.map((membership) =>
          getWorkOS().userManagement.deleteOrganizationMembership(membership.id)
        )
      );
    },
    catch: (cause) =>
      new WorkOSSyncError({
        message: "Failed to remove WorkOS membership",
        cause,
      }),
  }).pipe(skipInDemo);
});

export const removeMembershipFromWorkOS = Effect.fn(
  "organizations.sync.removeWorkOSMembership"
)(function* (organizationId: string, userId: string) {
  yield* removeMembershipFromWorkOSStrict(organizationId, userId).pipe(
    logSyncFailure({ organizationId, userId })
  );
});
