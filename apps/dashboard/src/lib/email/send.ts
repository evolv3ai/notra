import { AiCreditsDepletedEmail } from "@notra/email/emails/ai-credits-depleted";
import { FeedbackEmail } from "@notra/email/emails/feedback";
import { GeoAlertEmail } from "@notra/email/emails/geo-alert";
import { ScheduledContentCreatedEmail } from "@notra/email/emails/schedule-content-created";
import { ScheduledContentFailedEmail } from "@notra/email/emails/schedule-content-failed";
import { ScheduledContentSkippedEmail } from "@notra/email/emails/schedule-content-skipped";
import { ScheduledPublicationFailedEmail } from "@notra/email/emails/scheduled-publication-failed";
import { SiteSuspendedEmail } from "@notra/email/emails/site-suspended";
import { VisibilityDropEmail } from "@notra/email/emails/visibility-drop";
import { WeeklySummaryEmail } from "@notra/email/emails/weekly-summary";
import { WelcomeEmail } from "@notra/email/emails/welcome";
import { WorkflowPausedEmail } from "@notra/email/emails/workflow-paused";
import { sendBrewEmail } from "@notra/email/utils/brew";
import { EMAIL_CONFIG } from "@notra/email/utils/config";
import { FEEDBACK_SENTIMENT_META } from "@notra/email/utils/feedback";

import type {
  SendAiCreditsDepletedEmailProps,
  SendVisibilityDropEmailProps,
  SendWeeklySummaryEmailProps,
  SendFeedbackEmailProps,
  SendGeoAlertEmailProps,
  SendScheduledContentCreatedEmailProps,
  SendScheduledContentFailedEmailProps,
  SendScheduledContentSkippedEmailProps,
  SendScheduledPublicationFailedEmailProps,
  SendSiteSuspendedEmailProps,
  SendWelcomeEmailProps,
  SendWorkflowPausedEmailProps,
} from "@/types/email/send";

export function getAppUrl() {
  return process.env.APP_URL ?? EMAIL_CONFIG.getAppUrl();
}

function getSchedulesLink(organizationSlug: string) {
  return `${getAppUrl()}/${organizationSlug}/automation`;
}

export async function sendWelcomeEmail({
  userEmail,
  slackInvited,
}: SendWelcomeEmailProps) {
  return sendBrewEmail({
    category: "welcome",
    to: userEmail,
    subject: "Welcome to Notra",
    react: WelcomeEmail({ slackInvited }),
    idempotencyKey: userEmail,
  });
}

export async function sendScheduledContentFailedEmail({
  digestBatchKey,
  recipientEmail,
  organizationName,
  scheduleName,
  reason,
  organizationSlug,
  subject,
}: SendScheduledContentFailedEmailProps) {
  return sendBrewEmail({
    category: "schedule-content-failed",
    to: recipientEmail,
    subject: subject ?? `${scheduleName} couldn't generate content`,
    react: ScheduledContentFailedEmail({
      organizationName,
      organizationSlug,
      scheduleName,
      reason,
      settingsLink: getSchedulesLink(organizationSlug),
    }),
    idempotencyKey: digestBatchKey,
  });
}

export async function sendScheduledPublicationFailedEmail({
  recipientEmail,
  failureKey,
  ...props
}: SendScheduledPublicationFailedEmailProps) {
  return sendBrewEmail({
    category: "schedule-content-failed",
    to: recipientEmail,
    subject: `"${props.postTitle}" could not be published`,
    react: ScheduledPublicationFailedEmail(props),
    idempotencyKey: `scheduled-publication:${failureKey}:${recipientEmail}`,
  });
}

export async function sendScheduledContentSkippedEmail({
  digestBatchKey,
  recipientEmail,
  organizationName,
  scheduleName,
  reason,
  organizationSlug,
  subject,
}: SendScheduledContentSkippedEmailProps) {
  return sendBrewEmail({
    category: "schedule-content-skipped",
    to: recipientEmail,
    subject: subject ?? `${scheduleName} skipped a run`,
    react: ScheduledContentSkippedEmail({
      organizationName,
      organizationSlug,
      scheduleName,
      reason,
      settingsLink: getSchedulesLink(organizationSlug),
    }),
    idempotencyKey: digestBatchKey,
  });
}

export async function sendAiCreditsDepletedEmail({
  digestBatchKey,
  recipientEmail,
  organizationName,
  automationName,
  organizationSlug,
  limitLabel,
  subject,
}: SendAiCreditsDepletedEmailProps) {
  const appUrl = getAppUrl();
  const creditsLink = limitLabel
    ? `${appUrl}/${organizationSlug}/settings/billing`
    : `${appUrl}/${organizationSlug}/settings/credits`;
  const defaultSubject = limitLabel
    ? "Your Notra plan limit was reached"
    : "Your Notra AI credits are depleted";
  return sendBrewEmail({
    category: "ai-credits-depleted",
    to: recipientEmail,
    subject: subject ?? defaultSubject,
    react: AiCreditsDepletedEmail({
      organizationName,
      organizationSlug,
      automationName,
      creditsLink,
      limitLabel,
    }),
    idempotencyKey: digestBatchKey,
  });
}

export async function sendWorkflowPausedEmail({
  recipientEmail,
  organizationName,
  automationName,
  organizationSlug,
  reason,
  pauseEventId,
  subject,
}: SendWorkflowPausedEmailProps) {
  return sendBrewEmail({
    category: "workflow-paused",
    to: recipientEmail,
    subject: subject ?? `${automationName} was paused`,
    react: WorkflowPausedEmail({
      organizationName,
      organizationSlug,
      automationName,
      reason,
      settingsLink: getSchedulesLink(organizationSlug),
    }),
    idempotencyKey: `${recipientEmail}:${pauseEventId}`,
  });
}

export async function sendFeedbackEmail({
  to,
  message,
  sentiment,
  userName,
  userEmail,
  organizationName,
  organizationSlug,
  pageUrl,
  userAgent,
}: SendFeedbackEmailProps) {
  const subjectPrefix = sentiment
    ? `${FEEDBACK_SENTIMENT_META[sentiment].emoji} `
    : "";

  return sendBrewEmail({
    category: "feedback",
    to,
    subject: `${subjectPrefix}New feedback from ${userName}`,
    react: FeedbackEmail({
      message,
      sentiment,
      userName,
      userEmail,
      organizationName,
      organizationSlug,
      pageUrl,
      userAgent,
    }),
    idempotencyKey: JSON.stringify([
      to,
      userName,
      userEmail,
      organizationName,
      organizationSlug,
      pageUrl,
      userAgent,
      sentiment,
      message,
    ]),
  });
}

export async function sendScheduledContentCreatedEmail({
  digestBatchKey,
  recipientEmail,
  organizationName,
  scheduleName,
  createdContent,
  contentType,
  contentOverviewLink,
  organizationSlug,
  subject,
  automationEmail,
}: SendScheduledContentCreatedEmailProps) {
  return sendBrewEmail({
    category: "schedule-content-created",
    to: recipientEmail,
    subject: subject ?? `New content from ${scheduleName}`,
    react: ScheduledContentCreatedEmail({
      organizationName,
      organizationSlug,
      scheduleName,
      createdContent,
      contentType,
      contentOverviewLink,
      automationEmail,
    }),
    idempotencyKey: digestBatchKey,
  });
}

export async function sendWeeklySummaryEmail({
  recipientEmail,
  weekKey,
  ...props
}: SendWeeklySummaryEmailProps) {
  return sendBrewEmail({
    category: "daily-summary",
    to: recipientEmail,
    subject: `Weekly GEO recap for ${props.organizationName}, ${props.weekLabel}`,
    react: WeeklySummaryEmail(props),
    idempotencyKey: `${recipientEmail}:${props.organizationSlug}:week:${weekKey}`,
  });
}

export async function sendVisibilityDropEmail({
  recipientEmail,
  dateKey,
  ...props
}: SendVisibilityDropEmailProps) {
  return sendBrewEmail({
    category: "daily-summary",
    to: recipientEmail,
    subject: `AI visibility dropped for ${props.organizationName}`,
    react: VisibilityDropEmail(props),
    idempotencyKey: `${recipientEmail}:${props.organizationSlug}:drop:${dateKey}`,
  });
}

export async function sendGeoAlertEmail({
  recipientEmail,
  alertKey,
  ...props
}: SendGeoAlertEmailProps) {
  return sendBrewEmail({
    category: "daily-summary",
    to: recipientEmail,
    subject: props.headline,
    react: GeoAlertEmail(props),
    idempotencyKey: `${recipientEmail}:${props.organizationSlug}:alert:${alertKey}`,
  });
}

export async function sendSiteSuspendedEmail({
  recipientEmail,
  abuseActionKey,
  ...props
}: SendSiteSuspendedEmailProps) {
  return sendBrewEmail({
    // No dedicated Brew trigger yet; this shares the account-notice one.
    category: "workflow-paused",
    to: recipientEmail,
    subject:
      props.scope === "workspace"
        ? `Your Notra workspace ${props.organizationName} was suspended`
        : `Your Notra site ${props.siteNames[0] ?? ""} was suspended`,
    react: SiteSuspendedEmail(props),
    idempotencyKey: `site-suspended:${abuseActionKey}:${recipientEmail}`,
  });
}
