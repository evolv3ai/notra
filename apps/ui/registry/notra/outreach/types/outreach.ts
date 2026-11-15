import type { ComponentProps, ReactNode } from "react";

import type {
  WorkflowLogoName,
  WorkflowOverlayProps,
} from "../../workflow/types/workflow";

export type OutreachStatus =
  | "found"
  | "drafted"
  | "sent"
  | "opened"
  | "replied"
  | "listed"
  | "declined";

export type OutreachStepStatus =
  | "sent"
  | "opened"
  | "replied"
  | "scheduled"
  | "cancelled";

export interface OutreachStatusConfig {
  className: string;
  label: string;
}

export interface OutreachCitation {
  engine: WorkflowLogoName;
  prompts: number;
}

export interface OutreachContact {
  email: string;
  name: string;
  role: string;
  source: string;
}

export interface OutreachCompetitor {
  name: string;
  position: number;
}

export interface OutreachSequenceStep {
  id: string;
  day: number;
  subject: string;
  status: OutreachStepStatus;
  at: string;
}

export interface OutreachProspect {
  id: string;
  title: string;
  url: string;
  domain: string;
  domainRating: number;
  status: OutreachStatus;
  citations: OutreachCitation[];
  competitors: OutreachCompetitor[];
  contact: OutreachContact;
  sequence: OutreachSequenceStep[];
  updatedAt: string;
}

export interface OutreachDraft {
  body: string;
  subject: string;
  to: string;
}

export interface OutreachVariable {
  key: string;
  label: string;
  value: string;
}

export interface OutreachStat {
  hint: string;
  label: string;
  value: string;
}

export type OutreachStatusBadgeProps = ComponentProps<"span"> & {
  status: OutreachStatus;
};

export type OutreachCitationsProps = ComponentProps<"span"> & {
  citations: OutreachCitation[];
};

export type OutreachProspectTableProps = ComponentProps<"div"> & {
  prospects: OutreachProspect[];
  emptyLabel?: ReactNode;
  onOpen?: (prospect: OutreachProspect) => void;
  onDraft?: (prospect: OutreachProspect) => void;
};

export type OutreachEmailDialogProps = WorkflowOverlayProps & {
  prospect?: OutreachProspect;
  drafts: OutreachDraft[];
  variables: OutreachVariable[];
  model?: string;
  onSend?: (prospect: OutreachProspect, draft: OutreachDraft) => void;
};

export type OutreachProspectSheetProps = WorkflowOverlayProps & {
  prospect?: OutreachProspect;
  onDraft?: (prospect: OutreachProspect) => void;
  onMarkListed?: (prospect: OutreachProspect) => void;
};

export type OutreachSequenceProps = ComponentProps<"ol"> & {
  steps: OutreachSequenceStep[];
};

export type OutreachStatsProps = ComponentProps<"div"> & {
  stats: OutreachStat[];
};

export type OutreachEmailComposerProps = Required<
  Pick<OutreachEmailDialogProps, "drafts" | "variables" | "model">
> &
  Pick<OutreachEmailDialogProps, "onSend"> & { prospect: OutreachProspect };

export interface OutreachFilter {
  label: string;
  statuses: OutreachStatus[];
}
