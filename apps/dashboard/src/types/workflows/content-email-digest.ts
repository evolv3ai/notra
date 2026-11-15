import type { ScheduledCreatedContentItem } from "@/types/email/send";

export type { ContentEmailDigestPayload } from "@notra/schemas/dashboard/workflows";

export type ContentEmailDigestKind =
  | "ai_credits_depleted"
  | "scheduled_content_created"
  | "scheduled_content_failed"
  | "scheduled_content_skipped";

interface ContentEmailDigestBaseEvent {
  organizationName: string;
  organizationSlug: string;
}

interface AiCreditsDepletedDigestEvent extends ContentEmailDigestBaseEvent {
  kind: "ai_credits_depleted";
  automationName: string;
  limitLabel?: string;
}

interface ScheduledContentCreatedDigestEvent extends ContentEmailDigestBaseEvent {
  kind: "scheduled_content_created";
  scheduleName: string;
  createdContent: ScheduledCreatedContentItem[];
  contentType: string;
  contentOverviewLink: string;
  subject?: string;
  /** The automation's Then notify step asked for this email. */
  automationEmail?: boolean;
}

interface ScheduledContentFailedDigestEvent extends ContentEmailDigestBaseEvent {
  kind: "scheduled_content_failed";
  scheduleName: string;
  reason: string;
  subject?: string;
}

interface ScheduledContentSkippedDigestEvent extends ContentEmailDigestBaseEvent {
  kind: "scheduled_content_skipped";
  scheduleName: string;
  reason: string;
  subject?: string;
}

export type ContentEmailDigestEvent =
  | AiCreditsDepletedDigestEvent
  | ScheduledContentCreatedDigestEvent
  | ScheduledContentFailedDigestEvent
  | ScheduledContentSkippedDigestEvent;

export type EnqueueContentEmailDigestEvent =
  ContentEmailDigestEvent extends infer Event
    ? Event extends ContentEmailDigestEvent
      ? Omit<Event, "kind">
      : never
    : never;

export interface EnqueueContentEmailDigestParams {
  organizationId: string;
  recipientEmails: string[];
  kind: ContentEmailDigestKind;
  event: EnqueueContentEmailDigestEvent;
  logPrefix: string;
}
