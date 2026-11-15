import type { IconSvgElement } from "@hugeicons/react";

import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

export type AutopilotTemplateCategory = "site" | "content" | "releases";

export interface AutopilotTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  category: AutopilotTemplateCategory;
  icon: IconSvgElement;
  source: string;
  output: "pull_request" | "post";
  trigger: "run" | "merge" | "weekly" | "drop";
  kind: AutopilotAutomationKind;
}

export interface AutopilotTemplateActions {
  jobs: Partial<Record<AutopilotAutomationKind, boolean>>;
  canManage: boolean;
  isAdding: boolean;
  onAddBuiltIn: (kind: AutopilotAutomationKind) => void;
  onOpenBuiltIn: (kind: AutopilotAutomationKind) => void;
}

export interface AutopilotTemplateCardProps extends AutopilotTemplateActions {
  template: AutopilotTemplate;
}
