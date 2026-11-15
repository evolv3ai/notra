import "server-only";
import { db } from "@notra/db/drizzle";
import { abuseActions, users } from "@notra/db/schema";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";

import { hasAdminRole } from "@/lib/auth/role";
import { listOwnedOrganizationIds } from "@/lib/moderation/queries";
import { badRequest, notFound } from "@/lib/orpc/utils/errors";
import { callSiteAdmin } from "@/lib/sites/dashboard";
import type {
  SiteAdminSuspendResponse,
  UserBanInput,
  UserBanResult,
} from "@/types/moderation";
import { isUserBanned } from "@/utils/ban";
import { addWorkspaceOutcome, emptyOutcome } from "@/utils/moderation-outcome";

async function revokeWorkOSSessions(workosUserId: string) {
  const workos = getWorkOS();
  const sessions = await (
    await workos.userManagement.listSessions(workosUserId)
  ).autoPagination();
  await Promise.all(
    sessions.map((session) =>
      workos.userManagement.revokeSession({ sessionId: session.id })
    )
  );
  return sessions.length;
}

/**
 * Bans or unbans a user. A ban blocks dashboard, console and API access on the
 * next request and signs the user out of every WorkOS session; it can also
 * suspend every workspace the user owns. Lifting a ban leaves those
 * suspensions in place, so each workspace is restored on its own.
 */
export async function setUserBanned(
  input: UserBanInput,
  actorId: string
): Promise<UserBanResult> {
  const { target, retry } = await db.transaction(async (tx) => {
    // Locked, so an overlapping ban or unban waits for this one instead of
    // being mistaken for a retry of a state that no longer holds.
    const [target] = await tx
      .select({
        id: users.id,
        role: users.role,
        workosUserId: users.workosUserId,
        banned: users.banned,
        banExpires: users.banExpires,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update");
    if (!target) {
      throw notFound("User not found");
    }
    if (target.id === actorId) {
      throw badRequest("You can't ban yourself");
    }
    if (input.banned && hasAdminRole(target.role)) {
      throw badRequest("Remove the admin role before banning a Notra admin");
    }
    // Repeating the user's current state finishes it instead of starting
    // over: the original ban reason stays, and the audit row is a retry.
    const retry = input.banned === isUserBanned(target);
    if (!retry) {
      await tx
        .update(users)
        .set({
          banned: input.banned,
          banReason: input.banned ? input.reason : null,
          banExpires: null,
        })
        .where(eq(users.id, target.id));
    }
    await tx.insert(abuseActions).values({
      id: `abuse_${crypto.randomUUID().replaceAll("-", "")}`,
      subjectType: "user",
      subjectId: target.id,
      action: input.banned ? "ban" : "unban",
      category: input.banned ? (input.category ?? null) : null,
      reason: input.reason,
      retry,
      actorUserId: actorId,
    });
    return { target, retry };
  });

  if (!input.banned) {
    return {
      retry,
      revokedSessions: 0,
      suspendedOrganizations: 0,
      outcome: emptyOutcome(),
    };
  }

  const revokedSessions = target.workosUserId
    ? await revokeWorkOSSessions(target.workosUserId).catch(
        (error: unknown) => {
          console.error("moderation.revoke_sessions_failed", error);
          return null;
        }
      )
    : 0;

  const organizationIds =
    input.suspendOrganizations && input.category
      ? await listOwnedOrganizationIds(target.id)
      : [];
  let outcome = {
    ...emptyOutcome(),
    sessionsRevoked: revokedSessions !== null,
  };
  for (const organizationId of organizationIds) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each call is a whole workspace takedown holding that workspace's lock; one failure must not stop the rest, since the ban is already stored
    const response = await callSiteAdmin({
      action: "setOrganizationSuspended",
      organizationId,
      actorId,
      suspended: true,
      reason: input.reason,
      category: input.category,
    })
      .then((result) => result as SiteAdminSuspendResponse)
      .catch((error: unknown) => {
        console.error("moderation.ban_workspace_suspension_failed", {
          organizationId,
          error,
        });
        return null;
      });
    outcome = addWorkspaceOutcome(outcome, response);
  }

  return {
    retry,
    revokedSessions,
    suspendedOrganizations: organizationIds.length - outcome.failedWorkspaces,
    outcome,
  };
}
