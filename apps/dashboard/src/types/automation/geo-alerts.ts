import type {
  GeoAlertActions,
  GeoAlertSignal,
  GeoAlertSourceConfig,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import type { ReactNode } from "react";

import type { GeoAlertPreset } from "@/types/automation/automations";

export interface GeoAlertFormProps {
  organizationId: string;
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAlert?: GeoAlertAutomation | null;
  preset?: GeoAlertPreset | null;
  onSaved?: () => void;
  kindPicker?: ReactNode;
}

export interface GeoAlertDestinations {
  slackConnected: boolean;
  ownerCount: number;
  webhookEndpointCount: number;
}

export interface GeoAlertDestinationsProps {
  organizationSlug: string;
  destinations?: GeoAlertDestinations;
  actions: GeoAlertActions;
  onToggle: (key: keyof GeoAlertActions, value: boolean) => void;
  /** Loading the destinations failed; the rows would only guess. */
  loadFailed?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}

export interface GeoAlertDestinationRowProps {
  checked: boolean;
  disabled?: boolean;
  hint: ReactNode;
  icon: ReactNode;
  id: string;
  label: string;
  onCheckedChange: (value: boolean) => void;
}

export interface GeoAlertChangeItem {
  prompt: string;
  /** Display label, e.g. "ChatGPT". */
  engine: string;
  /** Raw engine ID as stored on the check. */
  engineId: string;
  engineFamily: string;
  kind: string;
  competitors: string[];
  /** Short human summary, e.g. "No longer mentioned, Acme took your spot". */
  detail: string;
}

export interface GeoAlertMatch {
  signal: GeoAlertSignal;
  title: string;
  summary: string;
  changes: GeoAlertChangeItem[];
  /** All matching changes, including the ones cut from `changes`. */
  totalChanges: number;
}

/** A GEO alert automation as the dashboard sees it. */
export interface GeoAlertAutomation {
  id: string;
  organizationId: string;
  name: string;
  sourceConfig: GeoAlertSourceConfig;
  actions: GeoAlertActions;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoAlertDeliveryResult {
  slack: boolean | null;
  email: boolean | null;
  webhook: boolean | null;
}

export interface GeoAlertScanContext {
  organizationId: string;
  projectId: string;
  scanId: string;
  companyName: string;
  status: "completed" | "failed";
  failureReason?: string;
}
