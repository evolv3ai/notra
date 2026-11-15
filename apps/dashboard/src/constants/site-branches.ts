export const SITE_BRANCH_AUTOCOMMIT_MS = 15_000;
export const SITE_BRANCH_VISIBILITY_KEY = "notra:site-branches:v1";

export const SITE_BRANCH_DIALOG_TITLES = {
  create: "newBranch",
  rename: "rename",
  delete: "delete",
  discardDeleted: "discardDeleted",
} as const;

export const SITE_BRANCH_LEAVE_ERROR_KEY = "notra:site-branch-leave-error:v1";
export const SITE_BRANCH_DESTRUCTIVE_DIALOG_KINDS = new Set([
  "delete",
  "discardDeleted",
]);
