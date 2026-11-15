import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { members } from "@notra/db/schema";
import {
  SITE_ABUSE_EMAIL,
  SITE_SUSPENSION_CATEGORY_LABELS,
} from "@notra/sites-core/constants/sites";
import { and, eq } from "drizzle-orm";

import {
  SUSPENSION_NOTICE_LOOKUP_ATTEMPTS,
  SUSPENSION_NOTICE_LOOKUP_BACKOFF_MS,
} from "@/constants/site-suspension";
import { sendSiteSuspendedEmail } from "@/lib/email/send";
import type { SuspensionNotice } from "@/types/site-suspension";

async function findOwners(organizationId: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.query.members.findMany({
        where: and(
          eq(members.organizationId, organizationId),
          eq(members.role, "owner")
        ),
        with: {
          users: { columns: { email: true } },
          organizations: { columns: { name: true } },
        },
      });
    } catch (error) {
      if (attempt >= SUSPENSION_NOTICE_LOOKUP_ATTEMPTS) {
        logError("[SiteSuspension] Owner lookup failed", error, {
          organizationId,
        });
        return null;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, SUSPENSION_NOTICE_LOOKUP_BACKOFF_MS * attempt)
      );
    }
  }
}

/**
 * Emails the workspace owners why Notra suspended their site or workspace
 * and how to appeal, keyed on the audit row so a retried send is deduplicated.
 * Returns whether every owner was emailed; a failure never undoes the
 * suspension, it only tells the admin to reach the owners another way.
 */
export async function notifySuspension(
  notice: SuspensionNotice
): Promise<boolean> {
  const owners = await findOwners(notice.organizationId);
  if (!owners?.length) {
    return false;
  }
  const results = await Promise.all(
    owners.map(async (owner) => {
      const result = await sendSiteSuspendedEmail({
        recipientEmail: owner.users.email,
        abuseActionKey: notice.key,
        organizationName: owner.organizations.name,
        scope: notice.scope,
        siteNames: notice.siteNames,
        categoryLabel: SITE_SUSPENSION_CATEGORY_LABELS[notice.category],
        reason: notice.reason,
        appealEmail: SITE_ABUSE_EMAIL,
      }).catch((error: unknown) => ({ data: null, error }));
      if (result.error) {
        logError("[SiteSuspension] Owner notice failed", result.error, {
          organizationId: notice.organizationId,
        });
      }
      // A suppressed recipient got nothing, so the admin must reach them.
      return !result.error && !result.data?.skipped;
    })
  );
  return results.every(Boolean);
}
