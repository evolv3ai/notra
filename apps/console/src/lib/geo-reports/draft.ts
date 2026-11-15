import { nanoid } from "nanoid";

import { GEO_MODELS, GEO_NEW_REPORT_ID } from "@/constants/geo-report";
import type {
  GeoCompetitor,
  GeoModelPerception,
  GeoReport,
  GeoTrackedPrompt,
} from "@/types/geo-report";

const ID_LENGTH = 8;

export function newId() {
  return nanoid(ID_LENGTH);
}

export function createPrompt(
  modelIds: string[],
  seed: Partial<Pick<GeoTrackedPrompt, "text" | "intent">> = {}
): GeoTrackedPrompt {
  return {
    id: newId(),
    text: seed.text ?? "",
    intent: seed.intent ?? "best-of",
    ranks: Object.fromEntries(modelIds.map((id) => [id, null])),
  };
}

export function createCompetitor(
  seed: Partial<GeoCompetitor> = {}
): GeoCompetitor {
  return {
    id: newId(),
    name: "",
    domain: "",
    shareOfVoice: 0,
    mentionRate: 0,
    winsOn: "",
    ...seed,
  };
}

function createPerception(modelId: string): GeoModelPerception {
  return {
    modelId,
    sentiment: "neutral",
    mentionRate: 0,
    quote: "",
    claims: [],
  };
}

export function createEmptyReport(): GeoReport {
  const modelIds = GEO_MODELS.map((model) => model.id);
  return {
    id: GEO_NEW_REPORT_ID,
    status: "draft",
    company: { name: "", domain: "", category: "" },
    preparedAt: new Date().toISOString(),
    preparedBy: "Notra",
    summary: {
      visibilityScore: 0,
      shareOfVoice: 0,
      shareOfVoiceRank: 1,
      sentimentScore: 0,
      citations: 0,
    },
    modelIds,
    prompts: [],
    competitors: [],
    perceptions: modelIds.map(createPerception),
    opportunities: [],
    sources: [],
  };
}

/** Keeps perceptions and prompt ranks in step with the selected models. */
export function syncModels(report: GeoReport, modelIds: string[]): GeoReport {
  const perceptions = modelIds.map(
    (modelId) =>
      report.perceptions.find((item) => item.modelId === modelId) ??
      createPerception(modelId)
  );
  const prompts = report.prompts.map((prompt) => ({
    ...prompt,
    ranks: Object.fromEntries(
      modelIds.map((id) => [id, prompt.ranks[id] ?? null])
    ),
  }));
  return resetScanState({ ...report, modelIds, perceptions, prompts });
}

export function resetScanState(report: GeoReport): GeoReport {
  return {
    ...report,
    status: "draft",
    summary: createEmptyReport().summary,
    prompts: report.prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      intent: prompt.intent,
      ranks: Object.fromEntries(report.modelIds.map((id) => [id, null])),
    })),
    competitors: report.competitors.map((item) => ({
      ...item,
      shareOfVoice: 0,
      mentionRate: 0,
      winsOn: "",
    })),
    perceptions: report.modelIds.map(createPerception),
    opportunities: [],
    sources: [],
  };
}

const URL_PREFIX = /^https?:\/\//;
const WWW_PREFIX = /^www\./;

export function normalizeDomain(value: string) {
  const host = value
    .trim()
    .toLowerCase()
    .replace(URL_PREFIX, "")
    .replace(WWW_PREFIX, "")
    .split("/")[0];
  return host?.split("?")[0] ?? "";
}

export function nameFromDomain(domain: string) {
  const label = normalizeDomain(domain).split(".")[0] ?? "";
  return label ? `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}` : "";
}
