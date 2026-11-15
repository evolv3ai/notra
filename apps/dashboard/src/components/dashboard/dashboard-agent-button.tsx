"use client";

import { SidebarRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { useTranslations } from "use-intl";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { AgentIcon } from "@/components/icons/agent-icon";
import {
  setContentPanelDismissed,
  useContentPanelHasOverview,
} from "@/lib/content-panel-tab";
import { usePathname } from "@/lib/navigation";
import type { RightPanelId } from "@/types/components/right-panel";
import { isContentDetailPathname } from "@/utils/dashboard-paths";

export function DashboardAgentButton() {
  const t = useTranslations("dashboard.agent");
  const tCommon = useTranslations("common");
  const tOverview = useTranslations("content.overview");
  const pathname = usePathname();
  const { active, togglePanel } = useRightPanel();
  const hasOverview = useContentPanelHasOverview();
  const isContentDetail = isContentDetailPathname(pathname);
  const panelId: RightPanelId = isContentDetail ? "content" : "agent";
  const open = active === panelId;
  // Posts with an overview swap this for "Details". The post page reports
  // that once it mounts; until then nothing renders, so the button never
  // flashes "Ask agent" and lands together with the page's header toolbar.
  const isDetails = isContentDetail && hasOverview === true;
  const label = isDetails
    ? tOverview("detailsButton")
    : tCommon("labels.askAgent");

  if (isContentDetail && hasOverview === null) {
    return null;
  }

  return (
    <Button
      aria-label={isDetails ? label : open ? t("closeLabel") : t("openLabel")}
      aria-pressed={open}
      className="hover:bg-background size-7 px-0 lg:w-auto lg:px-2.5"
      onClick={() => {
        if (isDetails) {
          setContentPanelDismissed(open);
        }
        togglePanel(panelId);
      }}
      size="sm"
      title={label}
      variant={open ? "secondary" : "ghost"}
    >
      {isDetails ? (
        <HugeiconsIcon icon={SidebarRightIcon} strokeWidth={1.8} />
      ) : (
        <AgentIcon />
      )}
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}
