"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import Link from "@/components/framework/link";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { TrafficExportButton } from "@/components/geo/traffic-export-button";
import { TrafficPathFilter } from "@/components/geo/traffic-path-filter";
import { WebVisitorsSection } from "@/components/geo/web-visitors-section";
import { useSite } from "@/components/sites/site-context";
import { useGeoRange } from "@/lib/hooks/use-geo-range";
import { useSiteAnalytics } from "@/lib/hooks/use-sites";
import {
  useKnownTrafficPaths,
  useTrafficPathQuery,
} from "@/lib/hooks/use-traffic-path";
import { trafficPathOptions } from "@/utils/ai-traffic-pages";
import { siteHref } from "@/utils/site-links";

export function SiteAnalyticsPage() {
  const t = useTranslations("sites.analyticsPage");
  const { organizationId, organizationSlug, siteId, detail, liveDeployment } =
    useSite();
  const analyticsOn = detail.site.analyticsEnabled;
  const geoRange = useGeoRange();
  const [pathQuery] = useTrafficPathQuery();
  const query = useSiteAnalytics(organizationId, siteId, {
    ...geoRange.query,
    ...(pathQuery ? { path: pathQuery } : {}),
  });
  const data = query.data;
  const hasVisits =
    data !== undefined &&
    (data.web.totals.views > 0 ||
      data.traffic.sources.some((source) => source.visits > 0));
  const knownPaths = useKnownTrafficPaths(
    trafficPathOptions(data?.web.pages ?? []),
    siteId
  );
  const isFiltered = pathQuery !== "";
  const canShowAnalytics =
    data?.web.configured && (hasVisits || analyticsOn || isFiltered);
  const settingsLink = (
    <Link
      className={buttonVariants({ variant: "outline" })}
      href={siteHref(organizationSlug, siteId, "settings")}
    >
      {t("offAction")}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeading description={t("description")} title={t("title")}>
        <GeoRangePicker control={geoRange} />
      </PageHeading>
      {(query.isError && data === undefined) ||
      (data !== undefined &&
        !data.web.configured &&
        (hasVisits || analyticsOn)) ? (
        <EmptyState
          description={t("errorDescription")}
          title={t("errorTitle")}
        />
      ) : null}
      {data === undefined && !query.isError ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : null}
      {data !== undefined && !hasVisits && !analyticsOn && !isFiltered ? (
        <EmptyState
          action={settingsLink}
          description={t("offDescription")}
          title={t("offTitle")}
        />
      ) : null}
      {canShowAnalytics && !liveDeployment ? (
        <Alert>
          <AlertTitle>{t("notPublishedTitle")}</AlertTitle>
          <AlertDescription>{t("notPublishedDescription")}</AlertDescription>
        </Alert>
      ) : null}
      {data !== undefined && canShowAnalytics ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TrafficPathFilter paths={knownPaths} />
            <TrafficExportButton
              path={pathQuery}
              range={geoRange.query}
              traffic={data.traffic}
              web={data.web}
            />
          </div>
          <WebVisitorsSection
            engagement={data.engagement}
            range={geoRange.query}
            traffic={data.traffic}
            web={data.web}
          />
        </div>
      ) : null}
    </div>
  );
}
