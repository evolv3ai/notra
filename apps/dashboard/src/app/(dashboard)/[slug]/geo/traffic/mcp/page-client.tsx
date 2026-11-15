"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsPageSkeleton } from "@/app/(dashboard)/[slug]/analytics/skeleton";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { TrafficNav } from "@/components/geo/traffic-nav";
import { PageContainer } from "@/components/layout/container";
import { McpRequestSheet } from "@/components/mcp/mcp-request-sheet";
import {
  McpAnalyticsHero,
  McpAudienceSections,
  McpLoadFailed,
  McpRequestLog,
  McpServerRequestSections,
  McpSetupPrompt,
  McpToolSections,
} from "@/components/mcp/mcp-sections";
import { McpSessionSheet } from "@/components/mcp/mcp-session-sheet";
import { McpToolSheet } from "@/components/mcp/mcp-tool-sheet";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useGeoRange } from "@/lib/hooks/use-geo-range";
import { useMcpAnalytics } from "@/lib/hooks/use-mcp-analytics";
import type {
  McpAnalyticsPageProps,
  McpRequestLogEntry,
  McpSessionSummary,
} from "@/types/mcp-analytics";

export default function McpAnalyticsPage({
  organizationSlug,
}: McpAnalyticsPageProps) {
  const t = useTranslations("geo.pages");
  const [selectedRequest, setSelectedRequest] =
    useState<McpRequestLogEntry | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
  const [toolOpen, setToolOpen] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<McpSessionSummary | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const organization =
    activeOrganization?.slug === organizationSlug
      ? activeOrganization
      : getOrganization(organizationSlug);
  const organizationId = organization?.id ?? "";
  const geoRange = useGeoRange();
  const { data, isPending, isError, refetch } = useMcpAnalytics(
    organizationId,
    geoRange.query
  );

  if (isPending) {
    return <AnalyticsPageSkeleton />;
  }

  const hasData = data && data.totals.requests + data.requests.length > 0;
  const selectedTool =
    data?.tools.find((tool) => tool.name === selectedToolName) ?? null;
  const openTool = (name: string) => {
    const known = data?.tools.some((tool) => tool.name === name) ?? false;
    setSelectedToolName(known ? name : null);
    setToolOpen(known);
  };

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("mcp.description")}
          title={t("traffic.title")}
        >
          <div className="flex max-w-full flex-wrap items-center gap-3">
            {data?.server ? (
              <Badge shape="rounded" size="md" variant="outline">
                <span className="font-mono">
                  {data.server.name}@{data.server.version} ·{" "}
                  {data.server.protocolVersion}
                </span>
              </Badge>
            ) : null}
            <GeoRangePicker control={geoRange} />
          </div>
        </PageHeading>
        <TrafficNav slug={organizationSlug} />

        {isError && !data ? <McpLoadFailed onRetry={refetch} /> : null}
        {!isError && !hasData ? <McpSetupPrompt /> : null}
        {data && hasData ? (
          <>
            <McpAnalyticsHero data={data} />
            <McpToolSections data={data} onOpenTool={openTool} />
            <McpServerRequestSections data={data} onOpenTool={openTool} />
            <McpAudienceSections
              data={data}
              onOpenSession={(session) => {
                setSelectedSession(session);
                setSessionOpen(true);
              }}
              onOpenTool={openTool}
            />
            <McpRequestLog
              data={data}
              onOpenRequest={(entry) => {
                setSelectedRequest(entry);
                setRequestOpen(true);
              }}
            />
          </>
        ) : null}
      </div>
      <McpToolSheet
        onOpenChange={setToolOpen}
        onSelectTool={openTool}
        open={toolOpen}
        organizationId={organizationId}
        range={geoRange.query}
        tool={selectedTool}
      />
      <McpSessionSheet
        onOpenChange={setSessionOpen}
        open={sessionOpen}
        organizationId={organizationId}
        range={geoRange.query}
        session={selectedSession}
      />
      <McpRequestSheet
        entry={selectedRequest}
        onOpenChange={setRequestOpen}
        open={requestOpen}
      />
    </PageContainer>
  );
}
