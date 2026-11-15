import type { createDb } from "@notra/db/drizzle";
import { organizations, users } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { type AuthData, getOrganizationIdFromAuth } from "../types/auth";

const SUSPENDED_RECOVERY =
  "Notra suspended this account or workspace. Contact abuse@usenotra.com to appeal; retrying will not help.";

/**
 * Rejects otherwise valid credentials of a workspace Notra suspended or a
 * user Notra banned. Keys stay intact in Unkey, so lifting the suspension
 * restores them.
 */
export async function accountStandingFailure(
  db: Pick<ReturnType<typeof createDb>, "query">,
  auth: AuthData
): Promise<{ error: string; recovery: string } | null> {
  const organizationId = getOrganizationIdFromAuth(auth);
  const userId = "userId" in auth ? auth.userId : null;
  const [organization, user] = await Promise.all([
    organizationId
      ? db.query.organizations.findFirst({
          where: eq(organizations.id, organizationId),
          columns: { suspendedAt: true },
        })
      : undefined,
    userId
      ? db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { banned: true, banExpires: true },
        })
      : undefined,
  ]);
  if (organization?.suspendedAt) {
    return { error: "Workspace suspended", recovery: SUSPENDED_RECOVERY };
  }
  if (user?.banned && !(user.banExpires && user.banExpires <= new Date())) {
    return { error: "Account suspended", recovery: SUSPENDED_RECOVERY };
  }
  return null;
}
