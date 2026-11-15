import type { GeoModelCatalogEntry } from "@notra/geo-core/types/geo";

export function removedLegacyGeoModels(
  models: readonly GeoModelCatalogEntry[],
  selected: readonly string[],
  removed: readonly string[]
): GeoModelCatalogEntry[] {
  const selectedIds = new Set(selected);
  const removedIds = new Set(removed);
  return models.filter(
    (model) =>
      model.hidden && selectedIds.has(model.id) && removedIds.has(model.id)
  );
}
