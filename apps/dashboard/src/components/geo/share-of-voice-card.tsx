"use client";

import { GEO_EMPTY_COMPETITOR_SHARE_TIMESERIES } from "@notra/geo-core/constants/geo";
import type { ShareOfVoiceRow } from "@notra/geo-core/types/geo";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { InstrumentSection } from "ui/card";
import { useTranslations } from "use-intl";

import { ShareOfVoiceTable } from "@/components/geo/share-of-voice-table";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  useGeoCompetitorRowNavigation,
  useGeoSettings,
} from "@/lib/hooks/use-geo";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import type { ShareOfVoiceCardProps } from "@/types/geo";
import { scopeCompetitorShare } from "@/utils/geo-competitor-scope";
import { findOwnBrandDomain, isOwnBrandName } from "@/utils/geo-competitors";

export function ShareOfVoiceCard({
  points,
  timeseries = GEO_EMPTY_COMPETITOR_SHARE_TIMESERIES,
  competitors,
  isScanning = false,
  organizationSlug,
  organizationId,
  companyName,
  aliases,
}: ShareOfVoiceCardProps) {
  const tGeoShared = useTranslations("geo.shared");
  const navigation = useGeoCompetitorRowNavigation(
    organizationSlug,
    organizationId
  );
  const { domain: projectDomain } = useGeoActiveProject(organizationId ?? "");
  const { data: settingsData } = useGeoSettings(organizationId ?? "");
  const scoped = scopeCompetitorShare({
    points,
    timeseries,
    competitors: competitors ?? [],
    companyName,
    aliases,
    engines: settingsData?.settings?.engines,
    ignoredCompetitors: settingsData?.settings?.ignoredCompetitors,
  });
  const ownDomain = projectDomain ?? findOwnBrandDomain(aliases ?? []);
  const openRow = (row: ShareOfVoiceRow) => {
    trackEvent(POSTHOG_EVENTS.GEO_SHARE_OF_VOICE_SLICE_CLICKED, {
      is_own_brand:
        row.kind === "brand" && isOwnBrandName(row.brand, companyName, aliases),
      is_other: row.kind === "aggregate",
      share: row.share,
      mentions: row.mentions,
    });
    navigation.openRow(row.brand, row.kind === "aggregate");
  };
  const prefetchRow = (row: ShareOfVoiceRow) =>
    navigation.prefetchRow(row.brand, row.kind === "aggregate");

  return (
    <InstrumentSection
      bodyClassName="flex min-h-0 flex-1 flex-col"
      className="h-full"
      eyebrow={tGeoShared("shareOfVoice")}
      hint={tGeoShared("discoveredBrandsComeFromScan")}
    >
      <ShareOfVoiceTable
        aliases={aliases}
        companyName={companyName}
        competitors={competitors}
        isScanning={isScanning}
        onRowClick={organizationSlug ? openRow : undefined}
        onRowPointerEnter={organizationSlug ? prefetchRow : undefined}
        ownDomain={ownDomain}
        points={scoped.points}
        timeseries={scoped.timeseries}
      />
    </InstrumentSection>
  );
}
