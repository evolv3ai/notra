import type { FeedbackSentiment } from "@notra/email/types/feedback";
import type {
  GeoAlertEmailProps,
  VisibilityDropEmailProps,
  WeeklySummaryEmailProps,
} from "@notra/email/types/geo-recap";
import type { ScheduledPublicationFailedEmailProps } from "@notra/email/types/scheduled-publication-failed";
import type { SiteSuspendedEmailProps } from "@notra/email/types/site-suspended";
import type { WorkflowPausedReason } from "@notra/email/types/workflow-paused";

interface DigestEmailProps {
  digestBatchKey: string;
}

export interface SendFeedbackEmailProps {
  to: string;
  message: string;
  sentiment?: FeedbackSentiment;
  userName: string;
  userEmail: string;
  organizationName?: string;
  organizationSlug?: string;
  pageUrl?: string;
  userAgent?: string;
}

export interface SendScheduledContentFailedEmailProps extends DigestEmailProps {
  recipientEmail: string;
  organizationName: string;
  organizationSlug: string;
  scheduleName: string;
  reason: string;
  subject?: string;
}

export interface SendScheduledPublicationFailedEmailProps extends ScheduledPublicationFailedEmailProps {
  recipientEmail: string;
  /** One email per failure: row id plus failure time. */
  failureKey: string;
}

export interface SendScheduledContentSkippedEmailProps extends DigestEmailProps {
  recipientEmail: string;
  organizationName: string;
  organizationSlug: string;
  scheduleName: string;
  reason: string;
  subject?: string;
}

export interface SendAiCreditsDepletedEmailProps extends DigestEmailProps {
  recipientEmail: string;
  organizationName: string;
  organizationSlug: string;
  automationName: string;
  limitLabel?: string;
  subject?: string;
}

export interface SendWorkflowPausedEmailProps {
  recipientEmail: string;
  organizationName: string;
  organizationSlug: string;
  automationName: string;
  reason: WorkflowPausedReason;
  pauseEventId: string;
  subject?: string;
}

export interface ScheduledCreatedContentItem {
  title: string;
  contentLink: string;
}

export interface SendScheduledContentCreatedEmailProps extends DigestEmailProps {
  recipientEmail: string;
  organizationName: string;
  organizationSlug: string;
  scheduleName: string;
  createdContent: ScheduledCreatedContentItem[];
  contentType: string;
  contentOverviewLink: string;
  subject?: string;
  automationEmail?: boolean;
}

export interface SendWeeklySummaryEmailProps extends WeeklySummaryEmailProps {
  recipientEmail: string;
  /** Monday the recap was sent for; keys the Brew idempotency. */
  weekKey: string;
}

export interface SendVisibilityDropEmailProps extends VisibilityDropEmailProps {
  recipientEmail: string;
  dateKey: string;
}

export interface SendGeoAlertEmailProps extends GeoAlertEmailProps {
  recipientEmail: string;
  /** Dedupes the send, e.g. automation and scan. */
  alertKey: string;
}

export interface SendWelcomeEmailProps {
  userEmail: string;
  slackInvited: boolean;
}

export interface SendSiteSuspendedEmailProps extends SiteSuspendedEmailProps {
  recipientEmail: string;
  /** Dedupes the send per suspension: the audit row id for a site, the workspace id and suspension time for a workspace. */
  abuseActionKey: string;
}
