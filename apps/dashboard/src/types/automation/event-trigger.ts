import type { useEventTriggerForm } from "@/lib/hooks/use-event-trigger-form";
import type { EventTriggerPreset } from "@/types/automation/automations";
import type { SourceOption } from "@/types/automation/source-picker";
import type { BrandSettings } from "@/types/hooks/brand-analysis";
import type { Trigger } from "@/types/triggers/triggers";

export type { EventTriggerFormValues } from "@notra/schemas/dashboard/automation/event-trigger-form";

export interface EventTriggerFormProps {
  organizationId: string;
  onSuccess?: (trigger: Trigger) => void;
  editTrigger?: Trigger;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Starting values for a new trigger, e.g. from a template. */
  preset?: EventTriggerPreset | null;
  /** Lets a new automation switch to another trigger kind. */
  kindPicker?: React.ReactNode;
}

export interface TriggerSwitchRowProps {
  id: string;
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export interface IgnoreCommitPatternsFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  errors: Array<{ message?: string } | undefined>;
  fieldName: string;
}

export interface UseEventTriggerFormProps {
  organizationId: string;
  editTrigger?: Trigger;
  enabled: boolean;
  open: boolean;
  preset?: EventTriggerPreset | null;
  onSuccess?: (trigger: Trigger) => void;
  onClose: () => void;
}

type EventTriggerFormApi = ReturnType<typeof useEventTriggerForm>["form"];

export interface EventTriggerSectionProps {
  form: EventTriggerFormApi;
  isLoading: boolean;
  options: SourceOption[];
  onAddRepository: () => void;
  kindPicker?: React.ReactNode;
}

export interface EventTriggerRulesSectionProps {
  form: EventTriggerFormApi;
  brandVoices: BrandSettings[];
}

export interface EventTriggerDialogFooterProps {
  errorMessage: string | null;
  isEditMode: boolean;
  isPending: boolean;
  onCancel: () => void;
}

export interface RepositoryConnectionDialogsProps {
  githubIntegrationId?: string;
  isEditMode: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  organizationId: string;
}
