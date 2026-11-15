import {
  GEO_REPORT_MAX_SOURCES,
  GEO_SCAN_MAX_CLAIMS,
} from "@/constants/geo-report";
import type {
  GeoCitedSource,
  GeoClaim,
  GeoRecommendation,
  GeoReport,
  GeoScanProgress,
  GeoScanResult,
  GeoSentiment,
  GeoShelfSpaceOpportunity,
} from "@/types/geo-report";

import { newId } from "./draft";

const RANK_SCORE: Record<number, number> = { 1: 100, 2: 75, 3: 60 };
const LOW_RANK_SCORE = 40;
const SENTIMENT_SCORE: Record<GeoSentiment, number> = {
  positive: 4.5,
  neutral: 3,
  mixed: 2.5,
  negative: 1.5,
};
const SENTIMENT_ORDER: GeoSentiment[] = [
  "positive",
  "neutral",
  "mixed",
  "negative",
];
const MAX_RANK_FOR_SCORE = 3;
const WINS_ON_EXAMPLES = 2;

export interface GeoScanCell {
  promptId: string;
  result: GeoScanResult;
}

export interface GeoScanRunOptions {
  report: GeoReport;
  siteText: string;
  signal: AbortSignal;
  onProgress: (progress: GeoScanProgress) => void;
  onCell: (cell: GeoScanCell) => void;
  onError: (message: string) => void;
}

/** Fires every prompt × model cell at once; progress is reported as each one lands. */
export async function runGeoScan({
  report,
  siteText,
  signal,
  onProgress,
  onCell,
  onError,
}: GeoScanRunOptions) {
  const prompts = report.prompts.filter((prompt) => prompt.text.trim());
  const total = prompts.length * report.modelIds.length;
  let done = 0;
  let failed = 0;
  const competitors = report.competitors.map((competitor) => competitor.name);

  async function scanCell(modelId: string, prompt: (typeof prompts)[number]) {
    try {
      const response = await fetch("/api/geo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          prompt: prompt.text,
          company: report.company,
          competitors,
          siteText,
        }),
        signal,
      });
      const data = (await response.json()) as GeoScanResult | { error: string };
      if (!response.ok || "error" in data) {
        failed += 1;
        onError("error" in data ? data.error : `Scan failed for ${modelId}`);
      } else {
        onCell({ promptId: prompt.id, result: data });
      }
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      failed += 1;
      onError(error instanceof Error ? error.message : "Scan request failed");
    }
    done += 1;
    onProgress({
      total,
      done,
      failed,
      current: `${done} of ${total} answers in`,
    });
  }

  if (prompts.length === 0) {
    return;
  }
  onProgress({ total, done, failed, current: `Asking ${total} questions…` });
  await Promise.all(
    prompts.flatMap((prompt) =>
      report.modelIds.map((modelId) => scanCell(modelId, prompt))
    )
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Writes one scan cell into the report: the prompt's rank for that model. */
export function applyScanCell(report: GeoReport, cell: GeoScanCell): GeoReport {
  return {
    ...report,
    prompts: report.prompts.map((prompt) =>
      prompt.id === cell.promptId
        ? {
            ...prompt,
            ranks: { ...prompt.ranks, [cell.result.modelId]: cell.result.rank },
            answers: {
              ...prompt.answers,
              [cell.result.modelId]: {
                text: cell.result.answer,
                sources: cell.result.sources,
              },
            },
          }
        : prompt
    ),
  };
}

/** Derives summary, verdicts, competitor shares, sources and gaps from all cells. */
export function applyScanSummary(
  report: GeoReport,
  cells: GeoScanCell[]
): GeoReport {
  if (cells.length === 0) {
    return report;
  }
  const companyKey = normalize(report.company.name);
  const companyDomain = normalize(report.company.domain);

  // Visibility: average rank score across every prompt × model cell.
  const scores = cells.map((cell) => {
    const rank = cell.result.rank;
    if (rank === null) {
      return 0;
    }
    return rank <= MAX_RANK_FOR_SCORE
      ? (RANK_SCORE[rank] ?? LOW_RANK_SCORE)
      : LOW_RANK_SCORE;
  });
  const visibilityScore = Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length
  );

  // Mentions per brand across all answers.
  const mentions = new Map<string, number>();
  for (const cell of cells) {
    for (const key of new Set(cell.result.mentioned.map(normalize))) {
      mentions.set(key, (mentions.get(key) ?? 0) + 1);
    }
  }
  const companyMentions = cells.filter(
    (cell) => cell.result.rank !== null
  ).length;
  const competitorMentions = report.competitors.map((competitor) => ({
    competitor,
    count: mentions.get(normalize(competitor.name)) ?? 0,
  }));
  const totalMentions =
    companyMentions +
    competitorMentions.reduce((sum, item) => sum + item.count, 0);
  const share = (count: number) =>
    totalMentions === 0 ? 0 : count / totalMentions;
  const shareOfVoiceRank =
    1 +
    competitorMentions.filter((item) => item.count > companyMentions).length;

  const sentimentScore =
    cells.reduce(
      (sum, cell) => sum + SENTIMENT_SCORE[cell.result.sentiment],
      0
    ) / cells.length;

  // Sources: how often each domain was cited, and whether it showed up when the brand was named.
  const sourceStats = new Map<
    string,
    { title: string; count: number; withBrand: boolean }
  >();
  let citations = 0;
  for (const cell of cells) {
    for (const source of cell.result.sources) {
      citations += 1;
      const domain = hostnameOf(source.url);
      const entry = sourceStats.get(domain) ?? {
        title: source.title || domain,
        count: 0,
        withBrand: false,
      };
      entry.count += 1;
      entry.withBrand = entry.withBrand || cell.result.rank !== null;
      sourceStats.set(domain, entry);
    }
  }
  const sources: GeoCitedSource[] = [...sourceStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, GEO_REPORT_MAX_SOURCES)
    .map(([domain, entry]) => ({
      id: newId(),
      domain,
      name: domain === companyDomain ? `${domain} (own site)` : domain,
      share: citations === 0 ? 0 : entry.count / citations,
      brandPresent: entry.withBrand || domain === companyDomain,
    }));

  // Verdict per model.
  const perceptions = report.modelIds.map((modelId) => {
    const own = cells.filter((cell) => cell.result.modelId === modelId);
    const existing = report.perceptions.find(
      (item) => item.modelId === modelId
    );
    if (own.length === 0 && existing) {
      return existing;
    }
    const counts = new Map<GeoSentiment, number>();
    for (const cell of own) {
      counts.set(
        cell.result.sentiment,
        (counts.get(cell.result.sentiment) ?? 0) + 1
      );
    }
    const sentiment = SENTIMENT_ORDER.reduce<GeoSentiment>(
      (best, candidate) =>
        (counts.get(candidate) ?? 0) > (counts.get(best) ?? 0)
          ? candidate
          : best,
      "neutral"
    );
    const mentionedCells = own.filter((cell) => cell.result.rank !== null);
    const quote =
      mentionedCells.find((cell) => cell.result.quote)?.result.quote ??
      own.find((cell) => cell.result.quote)?.result.quote ??
      "";
    const seen = new Set<string>();
    const claims: GeoClaim[] = [];
    // Problems first, so the report leads with what needs fixing.
    const ordered = own
      .flatMap((cell) => cell.result.claims)
      .sort(
        (a, b) =>
          Number(a.status === "accurate") - Number(b.status === "accurate")
      );
    for (const claim of ordered) {
      const key = normalize(claim.text);
      if (!key || seen.has(key) || claims.length >= GEO_SCAN_MAX_CLAIMS) {
        continue;
      }
      seen.add(key);
      claims.push({ id: newId(), text: claim.text, status: claim.status });
    }
    return {
      modelId,
      sentiment,
      mentionRate: own.length === 0 ? 0 : mentionedCells.length / own.length,
      quote,
      claims,
    };
  });

  // Gaps: prompts no model mentions the brand for, held by whoever was named.
  const competitorByKey = new Map(
    report.competitors.map((competitor) => [
      normalize(competitor.name),
      competitor.id,
    ])
  );
  const opportunities: GeoShelfSpaceOpportunity[] = report.prompts.flatMap(
    (prompt) => {
      const own = cells.filter((cell) => cell.promptId === prompt.id);
      if (own.length === 0 || own.some((cell) => cell.result.rank !== null)) {
        return [];
      }
      const named = new Set<string>();
      const held = new Set<string>();
      for (const cell of own) {
        for (const name of cell.result.mentioned) {
          if (normalize(name) === companyKey) {
            continue;
          }
          named.add(name);
          const competitorId = competitorByKey.get(normalize(name));
          if (competitorId) {
            held.add(competitorId);
          }
        }
      }
      const existing = report.opportunities.find(
        (item) => normalize(item.prompt) === normalize(prompt.text)
      );
      return [
        {
          id: existing?.id ?? newId(),
          prompt: prompt.text,
          occupiedBy: [...held],
          gap: `None of the ${own.length} models mention ${report.company.name}. The answers name ${[...named].slice(0, 4).join(", ") || "other tools"}.`,
          action: existing?.action ?? "",
          channel: existing?.channel ?? "docs",
        },
      ];
    }
  );

  return {
    ...report,
    summary: {
      ...report.summary,
      visibilityScore,
      shareOfVoice: share(companyMentions),
      shareOfVoiceRank,
      sentimentScore: Math.round(sentimentScore * 10) / 10,
      citations,
    },
    competitors: competitorMentions.map(({ competitor, count }) => {
      const key = normalize(competitor.name);
      const promptIds = new Set(
        cells
          .filter((cell) =>
            cell.result.mentioned.some((name) => normalize(name) === key)
          )
          .map((cell) => cell.promptId)
      );
      const wonPrompts = report.prompts.filter((prompt) =>
        promptIds.has(prompt.id)
      );
      const examples = wonPrompts
        .slice(0, WINS_ON_EXAMPLES)
        .map((prompt) => `"${prompt.text}"`)
        .join(", ");
      return {
        ...competitor,
        shareOfVoice: share(count),
        mentionRate: cells.length === 0 ? 0 : count / cells.length,
        winsOn:
          wonPrompts.length === 0
            ? "Not named in any answer"
            : `Named in ${wonPrompts.length} of ${report.prompts.filter((prompt) => prompt.text.trim()).length} prompts, e.g. ${examples}`,
      };
    }),
    perceptions,
    sources,
    opportunities,
  };
}

/** Fills in the generated action and channel for each gap. */
export function applyRecommendations(
  report: GeoReport,
  items: GeoRecommendation[]
): GeoReport {
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    ...report,
    opportunities: report.opportunities.map((opportunity) => {
      const item = byId.get(opportunity.id);
      return item
        ? { ...opportunity, action: item.action, channel: item.channel }
        : opportunity;
    }),
  };
}
