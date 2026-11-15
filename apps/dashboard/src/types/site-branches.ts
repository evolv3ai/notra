import type { ReactNode } from "react";

import type { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDraftSaveState } from "@/types/site-drafts";
import type { SiteScope } from "@/types/sites";

export type SiteBranchStatus = Awaited<
  ReturnType<typeof dashboardOrpc.sites.branches.status.call>
>;
type SiteBranchEntry = Awaited<
  ReturnType<typeof dashboardOrpc.sites.branches.list.call>
>[number];

export interface SiteBranchControlsProps extends SiteScope {
  saveState?: SiteDraftSaveState;
  commitStatus?: "idle" | "pending" | "success" | "error";
  productionBranch: string;
  draftCount: number;
  draftVersion: string;
  unsaved: boolean;
  onSwitch: (branch: string) => Promise<void>;
  onPublish: () => void;
  onFlush: () => Promise<void>;
  /** Persists unsaved edits as drafts without committing them. */
  onSave: () => Promise<void>;
}

type SiteBranchController = ReturnType<
  typeof import("@/lib/hooks/use-site-branch-controls").useSiteBranchControls
>;

export interface SiteBranchControllerProps {
  controller: SiteBranchController;
}

export interface SiteBranchSwitcherProps extends SiteBranchControllerProps {
  /** Only one mounted switcher (sidebar or Files sheet) may own the open menu. */
  menuActive: boolean;
}

export interface SiteBranchDialogProps {
  action: {
    kind: "create" | "rename" | "delete" | "discardDeleted";
    branch: string;
    branches?: string[];
  } | null;
  draftCount: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: (title: string, bringChanges: boolean) => void;
}

export interface SiteBranchDialogDescriptionProps {
  action: SiteBranchDialogProps["action"];
}

export interface SiteBranchBringFieldsProps {
  name: string;
  draftCount: number;
  bring: boolean;
  onBringChange: (bring: boolean) => void;
}

export interface SiteBranchMenuProps {
  pullRequest?: SiteBranchStatus["pullRequest"];
  actions?: ReactNode;
  error?: boolean;
  onRetry?: () => void;
  creating: boolean;
  onStartCreate: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  productionBranch: string;
  entries: SiteBranchEntry[];
  loading: boolean;
  disabled: boolean;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (branch: string) => void;
  onAction: (action: NonNullable<SiteBranchDialogProps["action"]>) => void;
}

export interface SiteWorkingBranchProps {
  branch?: string;
  onSwitch: (branch: string | null) => Promise<void>;
}

export interface SiteBranchPrimaryActionProps {
  checking?: boolean;
  error?: boolean;
  describedBy?: string;
  feature: boolean;
  status?: SiteBranchStatus;
  busy: boolean;
  invalid: boolean;
  draftCount: number;
  unsaved: boolean;
  /** Pending autosave counts as a change Publish can pick up. */
  saving?: boolean;
  onCreate: () => void;
  onPublish: () => void;
  onFlush: () => void;
  onReview: (merge: boolean) => void;
}

export interface SiteBranchEditInput {
  title: string;
  bringChanges: boolean;
}

export interface SiteBranchPrimaryState {
  action: "create" | "publish" | "requestReview" | "merge";
  disabled: boolean;
  showSave: boolean;
}

export interface SiteBranchPublishActionsProps {
  describedBy?: string;
  controls: SiteBranchControlsProps;
  status?: SiteBranchStatus;
  invalid: boolean;
}

export interface SiteBranchBadgeProps {
  live: boolean;
  pullRequest?: SiteBranchStatus["pullRequest"];
}
export interface SiteBranchEntryProps extends Pick<
  SiteBranchMenuProps,
  "current" | "productionBranch" | "onSelect" | "onAction"
> {
  entry: SiteBranchEntry;
  label: string;
}

export interface SiteBranchScrollListProps {
  count: number;
  children: ReactNode;
}

export type SitePullRequestTone =
  | "success"
  | "warning"
  | "destructive"
  | "muted";
