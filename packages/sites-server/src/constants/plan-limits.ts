import type { SitePlanLimit } from "../types/plan-limits";

/** Free workspaces get one site and one custom domain; paid plans have no workspace cap. */
export const FREE_PLAN_LIMITS: Record<
  Exclude<SitePlanLimit, "branding">,
  number
> = {
  sites: 1,
  domains: 1,
};

export const SITE_PLAN_LIMIT_MESSAGES: Record<SitePlanLimit, string> = {
  sites:
    "The Free plan includes 1 site per workspace. Upgrade to create more sites.",
  domains:
    "The Free plan includes 1 custom domain per workspace. Upgrade to add more domains.",
  branding:
    "The Free plan always shows the Powered by Notra badge. Upgrade to remove it.",
};

export const SITE_PLAN_UNAVAILABLE_MESSAGE =
  "Couldn't verify your plan. Try again in a moment.";
