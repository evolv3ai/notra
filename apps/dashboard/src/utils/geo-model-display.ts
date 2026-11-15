import { GEO_ENGINE_LABELS } from "@notra/geo-core/constants/geo";
import {
  engineFamilyLabel,
  engineModelOf,
} from "@notra/geo-core/utils/geo-engine-family";
import { formatModelSlug } from "@notra/geo-core/utils/geo-model-label";
import { isGroundedEngine } from "@notra/geo-core/utils/geo-presence";

import {
  MODELS_DEV_LOGO_ALIASES,
  MODELS_DEV_LOGO_BASE,
} from "@/constants/geo-models";
import type { ParsedModelId } from "@/types/geo";

const CHART_DIRECT_LABEL_SUFFIX = " (direct)";
const CHART_GROUNDED_LABEL_SUFFIX = " (grounded)";

export function splitModelId(modelId: string): ParsedModelId | null {
  const trimmed = modelId.trim();
  const separator = trimmed.indexOf("/");
  if (separator <= 0 || separator === trimmed.length - 1) {
    return null;
  }
  return {
    provider: trimmed.slice(0, separator).toLowerCase(),
    slug: trimmed.slice(separator + 1),
  };
}

function modelsDevLogoSlug(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  return ownCatalogLabel(MODELS_DEV_LOGO_ALIASES, normalized) ?? normalized;
}

export function modelsDevLogoUrl(provider: string): string {
  return `${MODELS_DEV_LOGO_BASE}/${encodeURIComponent(modelsDevLogoSlug(provider))}.svg`;
}

export function formatModelLabel(modelId: string): string {
  const trimmed = modelId.trim();
  const engineLabel = engineFamilyLabel(trimmed);
  if (engineLabel !== trimmed) {
    return engineLabel;
  }
  const parsed = splitModelId(trimmed);
  return formatModelSlug(parsed?.slug ?? trimmed);
}

function chartLabelToEngineId(label: string): string {
  if (label.endsWith(CHART_DIRECT_LABEL_SUFFIX)) {
    return `${label.slice(0, -CHART_DIRECT_LABEL_SUFFIX.length)}-direct-grounded`;
  }
  if (label.endsWith(CHART_GROUNDED_LABEL_SUFFIX)) {
    return `${label.slice(0, -CHART_GROUNDED_LABEL_SUFFIX.length)}-grounded`;
  }
  return label;
}

function ownCatalogLabel(
  catalog: Record<string, string>,
  key: string
): string | undefined {
  return Object.hasOwn(catalog, key) ? catalog[key] : undefined;
}

function chartEngineModelId(engine: string): string {
  const model = engineModelOf(engine);
  return typeof model === "string" ? model : engine;
}

function catalogEngineLabel(engine: string): string {
  const model = chartEngineModelId(engine);
  return (
    ownCatalogLabel(GEO_ENGINE_LABELS, model) ??
    ownCatalogLabel(GEO_ENGINE_LABELS, engine) ??
    ownCatalogLabel(GEO_ENGINE_LABELS, `${model}-grounded`) ??
    formatModelLabel(model)
  );
}

function isDisplayLabel(label: string): boolean {
  return /[A-Z]/.test(label) || /\s/.test(label);
}

function resolveChartEngineId(label: string): string {
  return chartLabelToEngineId(label.trim());
}

export function formatChartEngineLabel(label: string): string {
  const trimmed = label.trim();
  const engineId = chartLabelToEngineId(trimmed);
  const catalog =
    ownCatalogLabel(GEO_ENGINE_LABELS, engineId) ??
    ownCatalogLabel(GEO_ENGINE_LABELS, trimmed) ??
    ownCatalogLabel(GEO_ENGINE_LABELS, chartEngineModelId(engineId));
  if (catalog) {
    return catalog;
  }
  if (isDisplayLabel(trimmed) && splitModelId(engineId) === null) {
    return trimmed;
  }
  return catalogEngineLabel(engineId);
}

export function formatChartEngineRankLabel(
  label: string,
  showSearchMode: boolean,
  formatWithoutSearch: (engine: string) => string
): string {
  const name = formatChartEngineLabel(label);
  if (!showSearchMode) {
    return name;
  }
  return isGroundedEngine(resolveChartEngineId(label))
    ? name
    : formatWithoutSearch(name);
}
