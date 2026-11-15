"use client";

import { GEO_TRAFFIC_HOST_ALL } from "@notra/geo-core/constants/geo";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useTranslations } from "use-intl";

import { TRAFFIC_SITES_EXCLUDE_OPTION } from "@/constants/traffic-sites";
import { useGeoTrafficHostQuery } from "@/lib/hooks/use-geo-traffic-host";
import { useTrafficSitesQuery } from "@/lib/hooks/use-traffic-sites";
import type { TrafficDomainSelectProps } from "@/types/geo";
import {
  trafficHostSelectOptions,
  trafficHostSelectValue,
} from "@/utils/ai-traffic-pages";

export function TrafficDomainSelect({
  hosts,
  siteHosts = [],
}: TrafficDomainSelectProps) {
  const t = useTranslations("geo.trafficPagesCard");
  const tSites = useTranslations("geo.trafficSites");
  const [hostQuery, setHostQuery] = useGeoTrafficHostQuery();
  const [sitesQuery, setSitesQuery] = useTrafficSitesQuery();
  const options = trafficHostSelectOptions(hosts, hostQuery);
  const siteOptions = trafficHostSelectOptions(siteHosts, "");
  // Keep the grouped menu while the filter is on, even if no Site has
  // traffic in this range, so "All traffic" can still clear it.
  const groupSites = siteOptions.length > 0 || sitesQuery === "exclude";
  const siteSet = new Set(siteOptions);
  const domainOptions = options.filter((host) => !siteSet.has(host));
  const withoutSites = sitesQuery === "exclude" && hostQuery === "";
  const value = withoutSites
    ? TRAFFIC_SITES_EXCLUDE_OPTION
    : trafficHostSelectValue(hostQuery);
  if (!groupSites && options.length < 2 && value === GEO_TRAFFIC_HOST_ALL) {
    return null;
  }
  const allLabel = groupSites ? tSites("allTraffic") : t("allDomains");
  let label = value;
  if (value === GEO_TRAFFIC_HOST_ALL) {
    label = allLabel;
  } else if (withoutSites) {
    label = tSites("withoutSites");
  }
  const hostItems = (items: readonly string[]) =>
    items.map((host) => (
      <SelectItem key={host} value={host}>
        {host}
      </SelectItem>
    ));
  const hostGroup = (title: string, items: readonly string[]) =>
    items.length > 0 ? (
      <>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{title}</SelectLabel>
          {hostItems(items)}
        </SelectGroup>
      </>
    ) : null;
  return (
    <Select
      onValueChange={(next) => {
        if (!next) {
          return;
        }
        if (next === TRAFFIC_SITES_EXCLUDE_OPTION) {
          setHostQuery("");
          setSitesQuery("exclude");
          return;
        }
        setSitesQuery(null);
        setHostQuery(next === GEO_TRAFFIC_HOST_ALL ? "" : next);
      }}
      value={value}
    >
      <SelectTrigger
        aria-label={t("filterByDomain")}
        className="w-auto max-w-72 min-w-36"
        size="sm"
      >
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto max-w-(--available-width) min-w-(--anchor-width)">
        <SelectItem value={GEO_TRAFFIC_HOST_ALL}>{allLabel}</SelectItem>
        {groupSites ? (
          <>
            <SelectItem value={TRAFFIC_SITES_EXCLUDE_OPTION}>
              {tSites("withoutSites")}
            </SelectItem>
            {hostGroup(tSites("yourDomains"), domainOptions)}
            {hostGroup(tSites("sites"), siteOptions)}
          </>
        ) : (
          hostItems(options)
        )}
      </SelectContent>
    </Select>
  );
}
