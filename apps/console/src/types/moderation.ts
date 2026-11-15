import type {
  ABUSE_ACTIONS,
  ABUSE_SUBJECT_TYPES,
} from "@notra/db/constants/abuse";
import type { SiteSuspensionCategory } from "@notra/sites-core/types/sites";
import type * as z from "zod";

import type {
  organizationSuspendInputSchema,
  userBanInputSchema,
} from "@/schemas/moderation";

export type AbuseSubjectType = (typeof ABUSE_SUBJECT_TYPES)[number];
export type AbuseAction = (typeof ABUSE_ACTIONS)[number];

export interface WorkspaceSiteCounts {
  /** Active sites; above zero on a suspended workspace means it is unfinished. */
  activeSiteCount: number;
  /** Sites still down with the workspace; above zero once lifted means unfinished. */
  pendingRestoreCount: number;
}

export interface ModerationOrganization extends WorkspaceSiteCounts {
  id: string;
  name: string;
  slug: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  siteCount: number;
}

/** What the site admin route reports for a site or workspace suspension. */
export interface SiteAdminSuspendResponse {
  ok: true;
  /** The subject was already in the requested state; this finished it. */
  retry: boolean;
  /** Sites changed; only reported for a workspace. */
  sites?: number;
  /** Sites that kept their old state; repeating the action finishes them. */
  failed: number;
  /** Null when no notice was due, false when the owners weren't emailed. */
  noticeSent: boolean | null;
}

/** What an action could not finish, reported the same way on every path. */
export interface ModerationOutcome {
  failedSites: number;
  /** Workspaces a ban could not fully suspend. */
  failedWorkspaces: number;
  /** Workspaces whose owners were not emailed. */
  failedNotices: number;
  sessionsRevoked: boolean;
}

export type OrganizationSuspensionMode =
  | "suspend"
  | "finish-suspend"
  | "lift"
  | "finish-lift";

export interface OrganizationSuspensionCopy {
  trigger: string;
  title: string;
  description: string;
  confirm: string;
  lifts: boolean;
  /** Only a new suspension picks a category; a retry keeps the original. */
  needsCategory: boolean;
  reasonHint: string;
  reasonPlaceholder: string;
}

export interface ModerationUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  /** False once a ban has expired. */
  banned: boolean;
  banReason: string | null;
  ownedOrganizations: number;
}

export interface ModerationAction {
  id: string;
  subjectType: AbuseSubjectType;
  subjectId: string;
  subjectLabel: string | null;
  action: AbuseAction;
  category: SiteSuspensionCategory | null;
  reason: string | null;
  retry: boolean;
  actorName: string | null;
  createdAt: Date;
}

export type UserBanInput = z.output<typeof userBanInputSchema>;
export type UserBanRequest = z.input<typeof userBanInputSchema>;
export type OrganizationSuspendRequest = z.input<
  typeof organizationSuspendInputSchema
>;

export interface UserBanResult {
  /** The user was already in the requested state; this finished it. */
  retry: boolean;
  /** Null when WorkOS could not be reached; the ban still blocks sign-in. */
  revokedSessions: number | null;
  suspendedOrganizations: number;
  outcome: ModerationOutcome;
}

export interface OrganizationSuspendActionsProps {
  organizationId: string;
  organizationName: string;
  suspended: boolean;
  /** The last suspend or lift left sites behind; offer to finish it. */
  unfinished: boolean;
  /** Opens the suspending action on load, e.g. from a Slack link. */
  openOnLoad?: boolean;
}

export interface OrganizationSuspendDialogProps {
  organizationId: string;
  organizationName: string;
  mode: OrganizationSuspensionMode;
  defaultOpen: boolean;
}

export interface UserBanDialogProps {
  user: Pick<
    ModerationUser,
    "id" | "name" | "role" | "banned" | "ownedOrganizations"
  >;
  /** Trigger text; defaults to Ban or Unban. */
  label?: string;
  defaultOpen?: boolean;
}

export interface SuspensionFieldsProps {
  id: string;
  category?: SiteSuspensionCategory | null;
  /** Omit to hide the category picker, e.g. when lifting a suspension. */
  onCategoryChange?: (category: SiteSuspensionCategory) => void;
  categoryHint?: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  reasonHint: string;
  reasonPlaceholder: string;
}

export interface OwnedWorkspacesOptionProps {
  checked: boolean;
  count: number;
  onCheckedChange: (checked: boolean) => void;
}

export interface ModerationTableProps {
  columns: string[];
  /** Adds a right-aligned Action column. */
  action?: boolean;
  children: React.ReactNode;
}

export interface RestrictionStatusProps {
  restricted: boolean;
  label: string;
  reason: string | null;
}
