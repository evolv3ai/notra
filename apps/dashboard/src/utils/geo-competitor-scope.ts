import { competitorKey } from "@notra/geo-core/geo/domain";
import type {
  GeoCompetitorSharePoint,
  GeoCompetitorShareTimeseriesPoint,
} from "@notra/geo-core/types/geo";
import {
  brandFoldKey,
  competitorCanonicalMap,
} from "@notra/geo-core/utils/geo-competitor-names";
import {
  engineFamilyLabel,
  engineFamilyOf,
} from "@notra/geo-core/utils/geo-engine-family";
import { sumGeoSparklinePoints } from "@notra/geo-core/utils/geo-sparkline";

import {
  GEO_COMPETITOR_SUGGESTION_MIN_MENTIONS,
  GEO_COMPETITOR_SUGGESTIONS_MAX,
  GEO_COMPETITOR_UNTRACKED_RANKING_MAX,
} from "@/constants/geo-competitors";
import type {
  GeoCompetitorShareScope,
  GeoCompetitorShareScopeInput,
} from "@/types/geo-competitors";
import { isOwnBrandName } from "@/utils/geo-competitors";

function assistantKeys(engines: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const engine of engines) {
    const family = engineFamilyOf(engine);
    keys.add(brandFoldKey(family));
    keys.add(brandFoldKey(engineFamilyLabel(family)));
  }
  keys.delete("");
  return keys;
}

function withScopedTrends(
  points: readonly GeoCompetitorSharePoint[],
  series: readonly GeoCompetitorShareTimeseriesPoint[]
): GeoCompetitorSharePoint[] {
  const dailyTotals = new Map<string, number>();
  const byBrandDay = new Map<string, Map<string, number>>();
  for (const point of series) {
    dailyTotals.set(
      point.day,
      (dailyTotals.get(point.day) ?? 0) + point.mentions
    );
    const days = byBrandDay.get(point.brand) ?? new Map<string, number>();
    days.set(point.day, point.mentions);
    byBrandDay.set(point.brand, days);
  }
  const days = [...dailyTotals.keys()].sort();
  return points.map((point) => ({
    ...point,
    trend: days.map((day) => {
      const total = dailyTotals.get(day) ?? 0;
      const mentions = byBrandDay.get(point.brand)?.get(day) ?? 0;
      return {
        day,
        value: total === 0 ? 0 : Math.round((mentions * 1000) / total) / 1000,
      };
    }),
  }));
}

/**
 * Splits the brands scans found into what the page ranks and what it only
 * suggests, like Peec's tracked vs. suggested brands:
 * - Name variants fold into one brand (tracked synonyms, punctuation, case).
 * - The assistants being asked (ChatGPT, Claude, …) never count as rivals.
 * - Once anything is tracked, share of voice compares you with your tracked
 *   competitors only; every other brand becomes a suggestion.
 * - Until then, the most mentioned discovered brands stand in.
 */
export function scopeCompetitorShare({
  points,
  timeseries,
  competitors,
  companyName,
  aliases = [],
  engines = [],
  ignoredCompetitors = [],
}: GeoCompetitorShareScopeInput): GeoCompetitorShareScope {
  const canonicalByKey = competitorCanonicalMap(competitors);
  const trackedByFold = new Map<string, string>();
  for (const [key, name] of canonicalByKey) {
    trackedByFold.set(brandFoldKey(key), name);
  }
  const assistants = assistantKeys(engines);
  const ignored = new Set(ignoredCompetitors.map(brandFoldKey));
  const discoveredByFold = new Map<string, string>();
  for (const point of [...points].sort((a, b) => b.mentions - a.mentions)) {
    const fold = brandFoldKey(point.brand);
    if (!discoveredByFold.has(fold)) {
      discoveredByFold.set(fold, point.brand);
    }
  }

  const canonicalBrand = (brand: string): string | null => {
    if (companyName && isOwnBrandName(brand, companyName, aliases)) {
      return companyName;
    }
    const tracked =
      canonicalByKey.get(competitorKey(brand)) ??
      trackedByFold.get(brandFoldKey(brand));
    if (tracked) {
      return tracked;
    }
    const fold = brandFoldKey(brand);
    if (fold.length === 0 || assistants.has(fold)) {
      return null;
    }
    return discoveredByFold.get(fold) ?? brand;
  };

  const merged = new Map<string, GeoCompetitorSharePoint>();
  for (const point of points) {
    const brand = canonicalBrand(point.brand);
    if (!brand) {
      continue;
    }
    const existing = merged.get(brand);
    merged.set(brand, {
      brand,
      mentions: (existing?.mentions ?? 0) + point.mentions,
      trend: sumGeoSparklinePoints([existing?.trend ?? [], point.trend ?? []]),
    });
  }
  const mergedSeries = new Map<string, GeoCompetitorShareTimeseriesPoint>();
  for (const point of timeseries) {
    const brand = canonicalBrand(point.brand);
    if (!brand) {
      continue;
    }
    const key = `${brand}\u0000${point.day}`;
    const existing = mergedSeries.get(key);
    mergedSeries.set(key, {
      brand,
      day: point.day,
      mentions: (existing?.mentions ?? 0) + point.mentions,
    });
  }
  const fromSeries = new Map<string, GeoCompetitorSharePoint>();
  for (const point of mergedSeries.values()) {
    const tracked = canonicalByKey.has(competitorKey(point.brand));
    if (!tracked || merged.has(point.brand)) {
      continue;
    }
    const existing = fromSeries.get(point.brand);
    fromSeries.set(point.brand, {
      brand: point.brand,
      mentions: (existing?.mentions ?? 0) + point.mentions,
      trend: [],
    });
  }
  for (const [brand, point] of fromSeries) {
    merged.set(brand, point);
  }

  const isOwn = (brand: string) =>
    Boolean(companyName) && brand === companyName;
  const isTracked = (brand: string) => canonicalByKey.has(competitorKey(brand));
  const ranked = [...merged.values()].sort((a, b) => b.mentions - a.mentions);
  const discovered = ranked.filter(
    (point) =>
      !(isOwn(point.brand) || isTracked(point.brand)) &&
      !ignored.has(brandFoldKey(point.brand)) &&
      point.mentions >= GEO_COMPETITOR_SUGGESTION_MIN_MENTIONS
  );
  const trackedOnly = competitors.length > 0;
  const included = new Set(
    trackedOnly
      ? ranked
          .filter((point) => isOwn(point.brand) || isTracked(point.brand))
          .map((point) => point.brand)
      : [
          ...ranked.filter((point) => isOwn(point.brand)),
          ...discovered.slice(0, GEO_COMPETITOR_UNTRACKED_RANKING_MAX),
        ].map((point) => point.brand)
  );

  const scopedSeries = [...mergedSeries.values()].filter((point) =>
    included.has(point.brand)
  );
  const scopedPoints = ranked.filter((point) => included.has(point.brand));

  return {
    points:
      scopedSeries.length > 0
        ? withScopedTrends(scopedPoints, scopedSeries)
        : scopedPoints,
    timeseries: scopedSeries,
    suggestions: discovered
      .slice(0, GEO_COMPETITOR_SUGGESTIONS_MAX)
      .map((point) => ({ brand: point.brand, mentions: point.mentions })),
    trackedOnly,
  };
}
