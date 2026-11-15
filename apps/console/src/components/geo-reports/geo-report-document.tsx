import { cn } from "@notra/ui/lib/utils";

import {
  GEO_CHANNEL_LABELS,
  GEO_CLAIM_STATUS_LABELS,
  GEO_SECTION_ORDER,
  GEO_SENTIMENT_LABELS,
  GEO_SENTIMENT_SCORE_MAX,
  GEO_VISIBILITY_SCORE_MAX,
} from "@/constants/geo-report";
import type {
  GeoClaimStatus,
  GeoModel,
  GeoReport,
  GeoReportDocumentProps,
  GeoReportSectionId,
  GeoSentiment,
} from "@/types/geo-report";
import { formatPercent, formatReportDate } from "@/utils/geo-report";

import { BrandLogo } from "./brand-logo";
import { CompetitorRows } from "./competitor-rows";
import { CoverDither } from "./cover-dither";
import { NotraMark } from "./notra-mark";
import { PromptGrid } from "./prompt-grid";
import { ReportSection } from "./report-section";

const LOGO_SIZE_COVER = 48;
const LOGO_SIZE_ROW = 24;
const LOGO_SIZE_SMALL = 20;
const PERCENT = 100;
const GEO_COVER_DITHER_COLOR = "#C8B2EE";
const NOTRA_CONTACT_URL = "https://usenotra.com";
const SENTIMENT_CLASS: Record<GeoSentiment, string> = {
  positive: "bg-emerald-600 text-white",
  neutral: "bg-(--geo-paper-deep) text-(--geo-muted)",
  mixed: "bg-amber-400 text-amber-950",
  negative: "bg-red-600 text-white",
};

const CLAIM_STATUS_CLASS: Record<GeoClaimStatus, string> = {
  accurate: "text-emerald-700",
  outdated: "text-amber-700",
  missing: "text-(--geo-muted)",
  wrong: "text-red-600",
};

function ShareBar({
  fraction,
  tone,
}: {
  fraction: number;
  tone: "present" | "absent";
}) {
  return (
    <span
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full",
        tone === "absent" ? "bg-red-200" : "bg-(--geo-paper-deep)"
      )}
    >
      {tone === "absent" ? null : (
        <span
          className="block h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.round(fraction * PERCENT)}%` }}
        />
      )}
    </span>
  );
}

function CoverSection({ report }: { report: GeoReport }) {
  const { company } = report;
  return (
    <section className="geo-cover relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[40%] bg-(--geo-lavender)"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[40%] w-[30%]"
      >
        <CoverDither color={GEO_COVER_DITHER_COLOR} />
      </div>
      <div className="relative flex min-h-[36rem] max-w-xl flex-col justify-between gap-16 px-6 py-10 sm:px-14 sm:py-14">
        <div className="flex items-center gap-2 text-sm text-(--geo-muted)">
          <NotraMark className="size-5" />
          Prepared by {report.preparedBy}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <BrandLogo
              domain={company.domain}
              name={company.name}
              size={LOGO_SIZE_COVER}
            />
            <div>
              <p className="text-lg leading-tight font-semibold">
                {company.name}
              </p>
              <p className="text-sm text-(--geo-muted)">{company.domain}</p>
            </div>
          </div>
          <h1 className="mt-10 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.75rem] sm:leading-[1.05]">
            How AI models talk about {company.name}
          </h1>
        </div>
      </div>
    </section>
  );
}

function SummarySection({ report }: { report: GeoReport }) {
  const { summary } = report;
  const tiles = [
    {
      key: "visibility",
      value: `${summary.visibilityScore}`,
      label: "Visibility",
      note: `of ${GEO_VISIBILITY_SCORE_MAX}`,
    },
    {
      key: "share",
      value: formatPercent(summary.shareOfVoice),
      label: "Share of voice",
      note: `#${summary.shareOfVoiceRank} of ${report.competitors.length + 1} brands`,
    },
    {
      key: "sentiment",
      value: summary.sentimentScore.toFixed(1),
      label: "Sentiment",
      note: `of ${GEO_SENTIMENT_SCORE_MAX}`,
    },
    {
      key: "citations",
      value: `${summary.citations}`,
      label: "Citations",
      note: "sources the models linked",
    },
  ];

  return (
    <ReportSection
      id="summary"
      lede="Sampled per model, not per provider."
      title={`Where ${report.company.name} stands today`}
    >
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key}>
            <p className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">
              {tile.value}
            </p>
            <p className="mt-2 text-sm font-medium">{tile.label}</p>
            <p className="text-sm text-(--geo-muted)">{tile.note}</p>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function PromptsSection({
  report,
  models,
}: {
  report: GeoReport;
  models: GeoModel[];
}) {
  return (
    <ReportSection
      id="prompts"
      lede={`Each cell is the position where that model lists ${report.company.name} in its answer. 1 is best; click a cell to read the full answer.`}
      title={`${report.prompts.length} buying questions across ${models.length} models`}
    >
      <PromptGrid models={models} report={report} />
    </ReportSection>
  );
}

function CompetitorsSection({
  report,
  models,
}: {
  report: GeoReport;
  models: GeoModel[];
}) {
  return (
    <ReportSection
      id="competitors"
      lede="Red is ahead of the brand, green is behind. Click a row for the detail."
      title="Who owns the conversation"
    >
      <CompetitorRows models={models} report={report} />
    </ReportSection>
  );
}

function PerceptionsSection({
  report,
  models,
}: {
  report: GeoReport;
  models: GeoModel[];
}) {
  const cards = models.flatMap((model) => {
    const perception = report.perceptions.find(
      (item) => item.modelId === model.id
    );
    return perception ? [{ model, perception }] : [];
  });

  return (
    <ReportSection
      id="perceptions"
      lede="Each model's verdict, and the claims it gets wrong."
      title="What each model says"
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map(({ model, perception }) => {
          const fixes = perception.claims.filter(
            (claim) => claim.status !== "accurate"
          );
          return (
            <article
              className="flex flex-col rounded-xl border border-(--geo-line) bg-white p-5"
              key={model.id}
            >
              <header className="flex items-center gap-3">
                <BrandLogo
                  domain={model.providerDomain}
                  name={model.provider}
                  size={LOGO_SIZE_ROW}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm leading-tight font-semibold">
                    {model.name}
                  </h3>
                  <p className="text-xs text-(--geo-muted)">{model.surface}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    SENTIMENT_CLASS[perception.sentiment]
                  )}
                >
                  {GEO_SENTIMENT_LABELS[perception.sentiment]}
                </span>
              </header>
              <p className="mt-4 text-sm leading-relaxed">
                "{perception.quote}"
              </p>
              {fixes.length > 0 ? (
                <ul className="mt-4 grid gap-1.5 border-t border-(--geo-line) pt-3 text-sm">
                  {fixes.map((claim) => (
                    <li className="flex items-baseline gap-2" key={claim.text}>
                      <span
                        className={cn(
                          "w-16 shrink-0 text-xs font-medium",
                          CLAIM_STATUS_CLASS[claim.status]
                        )}
                      >
                        {GEO_CLAIM_STATUS_LABELS[claim.status]}
                      </span>
                      <span>{claim.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </ReportSection>
  );
}

function ShelfSpaceSection({ report }: { report: GeoReport }) {
  const competitorById = new Map(
    report.competitors.map((competitor) => [competitor.id, competitor])
  );

  return (
    <ReportSection
      id="shelf-space"
      lede="Ordered by impact. One piece of content per gap."
      title={`${report.opportunities.length} places competitors are listed and ${report.company.name} is not`}
    >
      <ol className="divide-y divide-(--geo-line)">
        {report.opportunities.map((opportunity) => (
          <li className="grid gap-6 py-6 md:grid-cols-2" key={opportunity.id}>
            <div>
              <p className="font-medium">{opportunity.prompt}</p>
              <p className="mt-2 text-sm leading-relaxed text-(--geo-muted)">
                {opportunity.gap}
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-(--geo-muted)">
                Held by
                {opportunity.occupiedBy.map((competitorId) => {
                  const competitor = competitorById.get(competitorId);
                  if (!competitor) {
                    return null;
                  }
                  return (
                    <BrandLogo
                      domain={competitor.domain}
                      key={competitorId}
                      name={competitor.name}
                      size={LOGO_SIZE_SMALL}
                    />
                  );
                })}
              </p>
            </div>
            <div className="text-sm leading-relaxed">
              <p>{opportunity.action}</p>
              <p className="mt-2 text-xs text-(--geo-muted)">
                {GEO_CHANNEL_LABELS[opportunity.channel]}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </ReportSection>
  );
}

function SourcesSection({ report }: { report: GeoReport }) {
  return (
    <ReportSection
      id="sources"
      lede="Green bars already mention the brand. Red tracks do not."
      title="Where the answers come from"
    >
      <ul className="divide-y divide-(--geo-line)">
        {report.sources.map((source) => (
          <li
            className="grid grid-cols-[auto_minmax(0,1fr)_3rem] items-center gap-4 py-3 sm:grid-cols-[auto_12rem_minmax(0,1fr)_3rem]"
            key={source.domain}
          >
            <BrandLogo
              domain={source.domain}
              name={source.name}
              size={LOGO_SIZE_SMALL}
            />
            <span className="truncate text-sm">{source.name}</span>
            <span className="col-span-2 sm:col-span-1">
              <ShareBar
                fraction={source.share}
                tone={source.brandPresent ? "present" : "absent"}
              />
            </span>
            <span className="text-right text-sm tabular-nums">
              {formatPercent(source.share)}
            </span>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

function PlanSection({ report }: { report: GeoReport }) {
  const gaps = report.opportunities.length;
  return (
    <ReportSection
      id="plan"
      lede={`Notra writes the changelogs, guides and posts from what you ship, then runs these ${report.prompts.length} prompts again every week so you can see what moved.`}
      title={`We can get ${report.company.name} into the ${gaps} answers it is missing from.`}
    >
      <a
        className="inline-flex h-10 items-center rounded-full bg-(--geo-ink) px-5 text-sm font-medium text-(--geo-paper) transition-colors hover:bg-(--geo-night)"
        href={NOTRA_CONTACT_URL}
        rel="noopener"
        target="_blank"
      >
        Talk to Notra
      </a>
    </ReportSection>
  );
}

export function GeoReportDocument({ report, options }: GeoReportDocumentProps) {
  const { sections, models } = options;
  const enabled = GEO_SECTION_ORDER.filter((id) => sections[id]);

  if (enabled.length === 0) {
    return (
      <div className="geo-report flex min-h-64 items-center justify-center p-10 text-center text-sm text-(--geo-muted)">
        No report sections are available in this view.
      </div>
    );
  }

  return (
    <article className="geo-report">
      {enabled.map((id: GeoReportSectionId) => {
        switch (id) {
          case "cover":
            return <CoverSection key={id} report={report} />;
          case "summary":
            return <SummarySection key={id} report={report} />;
          case "prompts":
            return <PromptsSection key={id} models={models} report={report} />;
          case "competitors":
            return (
              <CompetitorsSection key={id} models={models} report={report} />
            );
          case "perceptions":
            return (
              <PerceptionsSection key={id} models={models} report={report} />
            );
          case "shelf-space":
            return <ShelfSpaceSection key={id} report={report} />;
          case "sources":
            return <SourcesSection key={id} report={report} />;
          case "plan":
            return <PlanSection key={id} report={report} />;
          default:
            return null;
        }
      })}
      <footer className="flex items-center justify-between border-t border-(--geo-line) px-6 py-5 text-xs text-(--geo-muted) sm:px-14">
        <span>
          {report.company.name} · GEO report ·{" "}
          {formatReportDate(report.preparedAt)}
        </span>
        <span className="flex items-center gap-2">
          <NotraMark className="size-4" />
          Notra
        </span>
      </footer>
    </article>
  );
}
