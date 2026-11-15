import type {
  McpAnalyticsResponse,
  McpSessionResponse,
  McpToolDetailResponse,
} from "@notra/geo-core/types/mcp-analytics";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import type { GeoRangeQuery } from "@/types/geo";
import { geoOverviewQueryInput } from "@/utils/geo-query-input";

import { dashboardOrpc } from "../orpc/query";

function useMcpInput(organizationId: string, range: GeoRangeQuery) {
  const { projectId } = useGeoProjectScope();
  return geoOverviewQueryInput({ organizationId, projectId }, range);
}

export function useMcpAnalytics(organizationId: string, range: GeoRangeQuery) {
  const tToast = useTranslations("geo.toasts");
  return useQuery<McpAnalyticsResponse>({
    ...dashboardOrpc.geo.mcpAnalytics.queryOptions({
      input: useMcpInput(organizationId, range),
    }),
    enabled: !!organizationId,
    meta: { errorMessage: tToast("loadMcpAnalyticsFailed") },
  });
}

export function useMcpToolDetail(
  organizationId: string,
  range: GeoRangeQuery,
  tool: string | null
) {
  const tToast = useTranslations("geo.toasts");
  return useQuery<McpToolDetailResponse>({
    ...dashboardOrpc.geo.mcpToolDetail.queryOptions({
      input: { ...useMcpInput(organizationId, range), tool: tool ?? "" },
    }),
    enabled: !!organizationId && !!tool,
    meta: { errorMessage: tToast("loadMcpAnalyticsFailed") },
  });
}

export function useMcpSession(
  organizationId: string,
  range: GeoRangeQuery,
  sessionId: string | null
) {
  const tToast = useTranslations("geo.toasts");
  return useQuery<McpSessionResponse>({
    ...dashboardOrpc.geo.mcpSession.queryOptions({
      input: {
        ...useMcpInput(organizationId, range),
        sessionId: sessionId ?? "",
      },
    }),
    enabled: !!organizationId && !!sessionId,
    meta: { errorMessage: tToast("loadMcpAnalyticsFailed") },
  });
}
