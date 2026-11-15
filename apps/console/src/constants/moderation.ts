import type {
  AbuseAction,
  AbuseSubjectType,
  OrganizationSuspensionCopy,
  OrganizationSuspensionMode,
} from "@/types/moderation";

export const MODERATION_SEARCH_LIMIT = 20;
export const MODERATION_HISTORY_LIMIT = 50;
export const MODERATION_SEARCH_DEBOUNCE_MS = 250;
/** Warnings list steps for the admin, so they stay up longer than a toast. */
export const MODERATION_WARNING_TOAST_MS = 10_000;

export const REASON_PLACEHOLDERS = {
  suspend: "What we found, e.g. the home page asks for Microsoft 365 passwords",
  lift: "Why it can go back online, e.g. the appeal you accepted",
  retry: "Why you're running it again, e.g. a site failed last time",
};

const AUDIT_ONLY_HINT = "Recorded in the audit log.";

export const ORGANIZATION_SUSPENSION_COPY: Record<
  OrganizationSuspensionMode,
  OrganizationSuspensionCopy
> = {
  suspend: {
    trigger: "Suspend workspace",
    title: "Suspend",
    description:
      "Takes every active site offline, stops GitHub and API builds, blocks new sites and rejects the workspace's API keys. The owners get an email with the reason and how to appeal.",
    confirm: "Suspend workspace",
    lifts: false,
    needsCategory: true,
    reasonHint:
      "Recorded in the audit log and emailed to the owners. Not shown to visitors.",
    reasonPlaceholder: REASON_PLACEHOLDERS.suspend,
  },
  "finish-suspend": {
    trigger: "Finish suspension",
    title: "Finish suspending",
    description:
      "Some sites are still online after the last suspension. This takes them offline and keeps the original time, category and reason. Owners who weren't emailed get the notice now.",
    confirm: "Finish suspension",
    lifts: false,
    needsCategory: false,
    reasonHint: `${AUDIT_ONLY_HINT} Owners are emailed the original reason.`,
    reasonPlaceholder: REASON_PLACEHOLDERS.retry,
  },
  lift: {
    trigger: "Lift workspace suspension",
    title: "Lift the suspension of",
    description:
      "Sites taken offline by the workspace suspension are served again, and new sites, builds and API keys work again. Sites suspended on their own stay offline.",
    confirm: "Lift suspension",
    lifts: true,
    needsCategory: false,
    reasonHint: AUDIT_ONLY_HINT,
    reasonPlaceholder: REASON_PLACEHOLDERS.lift,
  },
  "finish-lift": {
    trigger: "Finish lifting suspension",
    title: "Finish lifting the suspension of",
    description:
      "Some sites are still offline after the last lift. This serves them again; sites suspended on their own stay offline.",
    confirm: "Finish lifting suspension",
    lifts: true,
    needsCategory: false,
    reasonHint: AUDIT_ONLY_HINT,
    reasonPlaceholder: REASON_PLACEHOLDERS.retry,
  },
};

/** Audit log wording per subject and action. */
export const ABUSE_ACTION_LABELS: Record<
  AbuseSubjectType,
  Partial<Record<AbuseAction, string>>
> = {
  site: { suspend: "Suspended site", unsuspend: "Reactivated site" },
  organization: {
    suspend: "Suspended workspace",
    unsuspend: "Lifted workspace suspension",
  },
  user: { ban: "Banned user", unban: "Unbanned user" },
};

export const BAN_COPY = {
  verb: "Ban",
  description:
    "Signs them out of every session and blocks the dashboard, console and their API credentials until they are unbanned.",
  confirm: "Ban user",
  destructive: true,
  reasonPlaceholder: REASON_PLACEHOLDERS.suspend,
};

export const UNBAN_COPY = {
  verb: "Unban",
  description:
    "They can sign in and use their API credentials again. Workspaces suspended with the ban stay suspended until you lift them.",
  confirm: "Unban",
  destructive: false,
  reasonPlaceholder: REASON_PLACEHOLDERS.lift,
};

export const BAN_REASON_HINTS = {
  auditOnly: AUDIT_ONLY_HINT,
  emailed:
    "Recorded in the audit log and emailed to the owners of the suspended workspaces. Not shown to visitors.",
};
