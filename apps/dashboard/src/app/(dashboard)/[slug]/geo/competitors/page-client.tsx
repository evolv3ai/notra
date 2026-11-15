"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { EmptyStateTablePreview } from "@/components/empty-state-preview";
import { CompetitorEditDialog } from "@/components/geo/competitor-edit-dialog";
import { CompetitorLostPromptsTable } from "@/components/geo/competitor-lost-prompts-table";
import { CompetitorSuggestionsTable } from "@/components/geo/competitor-suggestions-table";
import { CompetitorsTable } from "@/components/geo/competitors-table";
import { CompetitorsCsvImportDialog } from "@/components/geo/geo-csv-import-dialog";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { GeoSetupButton } from "@/components/geo/geo-setup-button";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  EMPTY_STATE_TABLE_COLUMNS,
  EMPTY_STATE_TABLE_ROWS,
} from "@/constants/empty-state";
import {
  useGeoCompetitorShare,
  useGeoPromptResults,
  useGeoSettings,
  useIsGeoScanning,
  usePrefetchGeoCompetitorEngineMatrix,
} from "@/lib/hooks/use-geo";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { useGeoCompetitorDomainBackfill } from "@/lib/hooks/use-geo-competitor-domain-backfill";
import { useGeoCompetitorsDb } from "@/lib/hooks/use-geo-db";
import { useGeoRange } from "@/lib/hooks/use-geo-range";
import { scopeCompetitorShare } from "@/utils/geo-competitor-scope";
import { shareOfVoiceByBrand } from "@/utils/geo-share-of-voice";
import dynamic from "@/utils/lazy-component";

import { GeoCompetitorsSkeleton } from "./skeleton";

const loadEngineMatrixCard = () =>
  import("@/components/geo/competitor-engine-matrix-card");
const loadShareCard = () => import("@/components/geo/competitor-share-card");

// Both cards render on every visit; fetch their chart chunks with the page
// instead of after it mounts.
if (typeof window !== "undefined") {
  void loadEngineMatrixCard().catch(() => undefined);
  void loadShareCard().catch(() => undefined);
}

const CompetitorEngineMatrixCard = dynamic(
  () =>
    loadEngineMatrixCard().then((module) => module.CompetitorEngineMatrixCard),
  {
    loading: () => <Skeleton className="h-96 w-full rounded-2xl" />,
    ssr: false,
  }
);

const CompetitorShareCard = dynamic(
  () => loadShareCard().then((module) => module.CompetitorShareCard),
  {
    loading: () => <Skeleton className="h-96 w-full rounded-2xl" />,
    ssr: false,
  }
);

interface PageClientProps {
  organizationSlug: string;
}

export default function PageClient({ organizationSlug }: PageClientProps) {
  const t = useTranslations("geo.pages.competitors");
  const tCommon = useTranslations("common");
  const tShared = useTranslations("geo.pages.shared");
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const orgFromList = getOrganization(organizationSlug);
  const organization =
    activeOrganization?.slug === organizationSlug
      ? activeOrganization
      : orgFromList;
  const organizationId = organization?.id ?? "";

  const geoRange = useGeoRange();
  const { data: settingsData, isPending } = useGeoSettings(organizationId);
  const { data: competitorShare, isPending: isSharePending } =
    useGeoCompetitorShare(organizationId, geoRange.query);
  usePrefetchGeoCompetitorEngineMatrix(organizationId, geoRange.query);
  const { data: promptResults, isPlaceholderData: isPromptResultsStale } =
    useGeoPromptResults(organizationId, geoRange.query);
  const { competitors } = useGeoCompetitorsDb(organizationId);
  const { domain: ownDomain } = useGeoActiveProject(organizationId);
  const isScanning = useIsGeoScanning(organizationId);
  useGeoCompetitorDomainBackfill(organizationId, competitors);
  const [managerOpen, setManagerOpen] = useState(false);
  const [initialName, setInitialName] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);

  const openManager = (name?: string) => {
    setInitialName(name);
    setManagerOpen(true);
  };

  useHotkey("C", () => openManager(), {
    enabled: !managerOpen && !importOpen,
  });

  if (isPending) {
    return <GeoCompetitorsSkeleton />;
  }

  const settings = settingsData?.settings ?? null;

  if (!settings) {
    return (
      <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="w-full space-y-6 px-4 lg:px-6">
          <PageHeading
            description={t("description")}
            title={tCommon("labels.competitors")}
          />
          <EmptyState
            action={<GeoSetupButton organizationId={organizationId} />}
            description={t("setupDescription")}
            preview={
              <EmptyStateTablePreview
                columns={EMPTY_STATE_TABLE_COLUMNS.competitors}
                rows={EMPTY_STATE_TABLE_ROWS}
              />
            }
            title={tShared("notSetUpTitle")}
          />
        </div>
      </PageContainer>
    );
  }

  const shareScope = scopeCompetitorShare({
    points: competitorShare?.points ?? [],
    timeseries: competitorShare?.timeseries ?? [],
    competitors,
    companyName: settings.companyName,
    aliases: settings.aliases,
    engines: settings.engines,
    ignoredCompetitors: settings.ignoredCompetitors,
  });
  const { points, timeseries } = shareScope;

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.competitors")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <GeoRangePicker control={geoRange} />
            <Button onClick={() => openManager()} size="sm">
              <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
              {t("newCompetitor")}
              <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
            </Button>
          </div>
        </PageHeading>
        {isSharePending ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : (
          <CompetitorShareCard
            aliases={settings.aliases}
            companyName={settings.companyName}
            competitors={competitors}
            isScanning={isScanning}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            points={points}
            timeseries={timeseries}
          />
        )}
        <CompetitorEngineMatrixCard
          aliases={settings.aliases}
          companyName={settings.companyName}
          competitors={competitors}
          isScanning={isScanning}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          range={geoRange.query}
          trackedEngines={settings.engines}
        />
        <CompetitorLostPromptsTable
          competitors={competitors}
          organizationSlug={organizationSlug}
          rangeParam={geoRange.param}
          results={isPromptResultsStale ? [] : (promptResults?.results ?? [])}
        />
        <CompetitorsTable
          aliases={settings.aliases}
          companyName={settings.companyName}
          competitors={competitors}
          isScanning={isScanning}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          ownDomain={ownDomain}
          shareByBrand={shareOfVoiceByBrand({
            points,
            competitors,
            companyName: settings.companyName,
            aliases: settings.aliases,
          })}
        />
        <CompetitorSuggestionsTable
          competitors={competitors}
          onTrack={openManager}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          suggestions={shareScope.suggestions}
        />
      </div>
      <CompetitorEditDialog
        competitor={null}
        initialName={initialName}
        onImportCsv={initialName ? undefined : () => setImportOpen(true)}
        onOpenChange={setManagerOpen}
        open={managerOpen}
        organizationId={organizationId}
      />
      <CompetitorsCsvImportDialog
        onOpenChange={setImportOpen}
        open={importOpen}
        organizationId={organizationId}
      />
    </PageContainer>
  );
}
