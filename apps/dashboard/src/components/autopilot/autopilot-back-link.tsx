"use client";

import { useQueryState } from "nuqs";

import { BackLink } from "@/components/layout/back-link";
import {
  AUTOPILOT_FROM_PARAM,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_AUTOMATIONS,
} from "@/constants/autopilot-ui";
import type { AutopilotBackLinkProps } from "@/types/autopilot";
import { automationKindFromSlug } from "@/utils/autopilot-automations";

/**
 * Back to where the page was opened from: the automation in `?from=`, else
 * the Autopilot page, on `tab` when given.
 */
export function AutopilotBackLink({ slug, tab }: AutopilotBackLinkProps) {
  const [from] = useQueryState(AUTOPILOT_FROM_PARAM);
  const base = `/${slug}${AUTOPILOT_NAV_LINK}`;
  const kind = from ? automationKindFromSlug(from) : null;
  let href = tab ? `${base}?tab=${tab}` : base;
  if (kind) {
    href = `${base}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`;
  }
  return (
    <BackLink href={href}>
      {kind ? AUTOPILOT_AUTOMATIONS[kind].name : "Autopilot"}
    </BackLink>
  );
}
