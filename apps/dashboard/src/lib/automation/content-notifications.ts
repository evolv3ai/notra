import { postSlackNotification } from "@notra/ai/integrations/slack-workspace";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { getAppUrl } from "@/lib/email/send";
import type { ContentCreatedSlackInput } from "@/types/workflows/content-generation-steps";
import { formatContentCreatedSlackText } from "@/utils/automation-notify";

/** Best effort: a failed announcement never fails the run that made the content. */
export async function postContentCreatedToSlack(
  input: ContentCreatedSlackInput
) {
  try {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, input.organizationId),
      columns: { slug: true },
    });
    if (!organization) {
      return;
    }
    const delivered = await postSlackNotification(
      input.organizationId,
      formatContentCreatedSlackText({
        automationName: input.automationName,
        contentLink: `${getAppUrl()}/${organization.slug}/content`,
        posts: input.posts,
      })
    );
    if (!delivered) {
      console.warn(
        `[AutomationNotify] No Slack notification channel accepted the message for organization ${input.organizationId}`
      );
    }
  } catch (error) {
    logError("[AutomationNotify] Slack delivery failed", error);
  }
}
