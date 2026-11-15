"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { useTranslations } from "use-intl";

import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { GeoSetupEmpty } from "@/components/geo/geo-setup-empty";
import { ScanModelMenu } from "@/components/geo/scan-model-menu";
import { PageContainer } from "@/components/layout/container";
import { useGeoOverviewPage } from "@/lib/hooks/use-geo-overview-page";
import { useNukeEasterEgg } from "@/lib/hooks/use-nuke-easter-egg";
import type { GeoOverviewLoadedProps, GeoPageClientProps } from "@/types/geo";

import { GeoTabs } from "./components/geo-tabs";
import { GeoPageSkeleton } from "./skeleton";

export default function PageClient({ organizationSlug }: GeoPageClientProps) {
  const page = useGeoOverviewPage(organizationSlug);

  if (page.status === "loading") {
    return <GeoPageSkeleton />;
  }

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      {page.status === "empty" ? (
        <div className="w-full px-4 lg:px-6">
          <GeoSetupEmpty organizationId={page.organizationId} page="overview" />
        </div>
      ) : (
        <GeoOverviewLoaded page={page} />
      )}
    </PageContainer>
  );
}

function GeoOverviewLoaded({ page }: GeoOverviewLoadedProps) {
  const t = useTranslations("geo.pages.overview");
  const headingRef = useNukeEasterEgg<HTMLSpanElement>();
  return (
    <div className="w-full space-y-6 px-4 lg:px-6">
      <PageHeading
        description={t("description", { companyName: page.companyName })}
        title={<span ref={headingRef}>GEO</span>}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <GeoRangePicker control={page.geoRange} />
          <ScanModelMenu {...page.scanMenu} />
        </div>
      </PageHeading>

      <GeoTabs {...page.tabs} />
    </div>
  );
}
