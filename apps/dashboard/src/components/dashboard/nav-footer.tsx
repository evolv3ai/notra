"use client";

import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notra/ui/components/ui/sidebar";
import { useTranslations } from "use-intl";

import { NAV_WORKSPACE_GROUP } from "@/constants/nav";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";

import { ConnectAgentPill } from "./connect-agent";
import { NavGroupList } from "./nav-group-list";
import { useActiveNavLink } from "./nav-jobs";
import { SidebarLabel } from "./sidebar-label";
import { SidebarAskAgentButton } from "./sidebar-quick-actions";

const DOCS_URL = "https://www.usenotra.com/docs";
const WORKSPACE_GROUPS = [NAV_WORKSPACE_GROUP];

export function NavFooter({ slug }: { slug: string }) {
  const tCommon = useTranslations("common.labels");
  const visibility = useNavVisibility();
  const [projectParam] = useGeoProjectQueryState();
  const activeLink = useActiveNavLink(slug);
  const docsLabel = tCommon("docs");

  return (
    <SidebarGroup className="gap-1 pb-0">
      <NavGroupList
        activeLink={activeLink}
        groups={WORKSPACE_GROUPS}
        projectId={projectParam ?? undefined}
        slug={slug}
        visibility={visibility}
      />
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={
              <a href={DOCS_URL} rel="noopener" target="_blank">
                <HugeiconsIcon icon={BookOpen01Icon} />
                <SidebarLabel>{docsLabel}</SidebarLabel>
              </a>
            }
            tooltip={docsLabel}
          />
        </SidebarMenuItem>
      </SidebarMenu>
      <div className="pt-2">
        <ConnectAgentPill />
        <SidebarAskAgentButton />
      </div>
    </SidebarGroup>
  );
}
