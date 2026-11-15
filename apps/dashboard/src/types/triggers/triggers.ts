import type {
  LookbackWindow,
  OutputContentType,
  WebhookEventType,
} from "@notra/schemas/dashboard/integrations";

type TriggerSourceType =
  | "github_webhook"
  | "linear_webhook"
  | "cron"
  | "manual";

interface TriggerTarget {
  repositoryIds: string[];
  linearIntegrationIds?: string[];
}

interface TriggerSourceConfig {
  eventTypes?: WebhookEventType[];
  includePreReleases?: boolean;
  ignoreCommitPatterns?: string[];
  cron?: {
    frequency: "daily" | "weekly" | "monthly" | "custom";
    hour: number;
    minute: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    intervalDays?: number;
    anchorDate?: string;
  };
}

interface TriggerOutputConfig {
  publishDestination?: "webflow" | "framer" | "custom";
  brandVoiceId?: string;
  instructions?: string;
  notify?: { slack: boolean; email: boolean };
}

export interface Trigger {
  id: string;
  organizationId: string;
  name: string;
  sourceType: TriggerSourceType;
  sourceConfig: TriggerSourceConfig;
  targets: TriggerTarget;
  outputType: OutputContentType;
  outputConfig?: TriggerOutputConfig | null;
  lookbackWindow?: LookbackWindow;
  enabled: boolean;
  autoPublish: boolean;
  createdAt: string;
  updatedAt: string;
}
