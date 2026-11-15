export const ABUSE_SUBJECT_TYPES = ["site", "organization", "user"] as const;
export const ABUSE_ACTIONS = ["suspend", "unsuspend", "ban", "unban"] as const;
/** Audit rows are kept this long for appeals and repeat abuse, then purged. */
export const ABUSE_ACTION_RETENTION_DAYS = 730;
