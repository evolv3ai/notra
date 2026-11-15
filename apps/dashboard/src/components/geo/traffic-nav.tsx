"use client";

import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { MCP_ANALYTICS_NAV_LINK } from "@/constants/mcp-analytics";
import { usePathname } from "@/lib/navigation";
import type { TrafficNavProps } from "@/types/mcp-analytics";
import { geoTrafficPath, withGeoProject } from "@/utils/geo-paths";

export function TrafficNav({ slug }: TrafficNavProps) {
  const t = useTranslations("geo.pages.traffic.tabs");
  const pathname = usePathname();
  const { projectId } = useGeoProjectScope();
  const mcpPath = `/${slug}${MCP_ANALYTICS_NAV_LINK}`;

  return (
    <Tabs value={pathname.startsWith(mcpPath) ? "mcp" : "website"}>
      <TabsList variant="line">
        <TabsTrigger
          nativeButton={false}
          render={<Link href={geoTrafficPath(slug, projectId)} />}
          value="website"
        >
          {t("website")}
        </TabsTrigger>
        <TabsTrigger
          nativeButton={false}
          render={<Link href={withGeoProject(mcpPath, projectId)} />}
          value="mcp"
        >
          {t("mcp")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
