import type { IconSvgElement } from "@hugeicons/react";
import type { EventTriggerFormValues } from "@notra/schemas/dashboard/automation/event-trigger-form";
import type {
  GeoAlertActions,
  GeoAlertSignal,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import type { AutomationNotify } from "@notra/schemas/shared/automation";
import type { ReactNode } from "react";

import type { GeoAlertAutomation } from "@/types/automation/geo-alerts";
import type { SchedulePresetId } from "@/types/automation/schedule";
import type { Trigger } from "@/types/triggers/triggers";

export type AutomationTemplateCategory = "content" | "geo" | "webhooks";

export type AutomationTriggerKind = "schedule" | "github" | "geo" | "event";
export type AutomationActionKind =
  | "content"
  | "slack"
  | "email"
  | "webhook"
  | "alert";

export type AutomationTemplateId =
  | "visibility-drop"
  | "competitor-gain"
  | "mention-lost"
  | "citation-lost"
  | "scan-summary"
  | "scan-failed"
  | "code-changes"
  | "release-announcement"
  | "weekly-changelog"
  | "daily-twitter"
  | "monthly-blog"
  | "biweekly-linkedin"
  | "webhooks";

export type AutomationTemplateTone =
  | "destructive"
  | "info"
  | "success"
  | "warning";

interface AutomationTemplateBase {
  id: AutomationTemplateId;
  tone: AutomationTemplateTone;
  category: AutomationTemplateCategory;
  icon: IconSvgElement;
  trigger: AutomationTriggerKind;
  action: AutomationActionKind;
}

export type EventTriggerPreset = Pick<
  EventTriggerFormValues,
  "eventType" | "outputType"
>;

export type AutomationTemplate =
  | (AutomationTemplateBase & {
      kind: "event";
      preset: EventTriggerPreset;
    })
  | (AutomationTemplateBase & {
      kind: "schedule";
      presetId: SchedulePresetId;
    })
  | (AutomationTemplateBase & {
      kind: "alert";
      signal: GeoAlertSignal;
    })
  | (AutomationTemplateBase & { kind: "webhooks" });

export type AutomationRow =
  | { kind: "schedule"; id: string; trigger: Trigger }
  | { kind: "event"; id: string; trigger: Trigger }
  | { kind: "alert"; id: string; alert: GeoAlertAutomation };

export interface AutomationsTableProps {
  rows: AutomationRow[];
  busyId?: string;
  emptyState: ReactNode;
  onEdit: (row: AutomationRow) => void;
  onToggle: (row: AutomationRow, enabled: boolean) => void;
  onDelete: (row: AutomationRow) => void;
  onRunNow: (row: AutomationRow) => void;
  onSendTest: (row: AutomationRow) => void;
  onViewRuns: (row: AutomationRow) => void;
  lastRuns: Map<string, string>;
}

export interface AutomationMenuItemsProps extends Pick<
  AutomationsTableProps,
  "onEdit" | "onDelete" | "onRunNow" | "onSendTest" | "onViewRuns"
> {
  row: AutomationRow;
  busy: boolean;
  variant: "context" | "dropdown";
}

export interface GeoAlertPreset {
  signal: GeoAlertSignal;
  actions?: Partial<GeoAlertActions>;
}

export interface AutomationNotifySectionProps {
  organizationId: string;
  value: AutomationNotify;
  onChange: (value: AutomationNotify) => void;
}
