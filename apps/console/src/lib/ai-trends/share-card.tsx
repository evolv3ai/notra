import "server-only";
import { loadRenderFont } from "@notra/ai/utils/render-font";
import { notraMarkSvg } from "@notra/ui/lib/notra-mark";
import { ImageResponse } from "next/og";

import {
  AI_TRENDS_CARD_HEIGHT,
  AI_TRENDS_CARD_LOGO_CACHE_SIZE,
  AI_TRENDS_CARD_LOGO_TIMEOUT_MS,
  AI_TRENDS_CARD_THEMES,
  AI_TRENDS_CARD_WIDTH,
  AI_TRENDS_FILL_ALPHA,
  AI_TRENDS_MAX_FILLED_SERIES,
} from "@/constants/ai-trends";
import type { AiTrendsShareCard } from "@/types/ai-trends";
import {
  formatChangeAmount,
  formatCountTick,
  formatShareTick,
} from "@/utils/ai-trends";
import { getBrandLogoCandidates } from "@/utils/brand-logo";
import { formatChartDay } from "@/utils/site-charts";

type Theme = (typeof AI_TRENDS_CARD_THEMES)[keyof typeof AI_TRENDS_CARD_THEMES];

interface CardSeries {
  label: string;
  color: string;
  values: number[];
}

const SHELL_PAD = 36;
const CARD_PAD = 52;
const TOP_BAR = 64;
const Y_AXIS_WIDTH = 64;
const X_AXIS_HEIGHT = 44;
const X_TICKS = 7;
/** The mark's own outline color; it never inverts for dark cards. */
const NOTRA_MARK_STROKE = "#1e1e1e";
const CLASS_ATTRIBUTE = / class="[^"]*"/g;
/** Roughly what fits on one line at 22px across the card; room is reserved per line. */
const DESCRIPTION_LINE_CHARS = 120;
const DESCRIPTION_LINE_HEIGHT = 32;
/** Space between the eyebrow and the headline, and above the stats. */
const TITLE_GAP = 24;
const STATS_GAP = 36;
/** Geist Bold's average advance in em, slightly generous so wrapping never overflows. */
const TITLE_CHAR_WIDTH = 0.5;
const CONTENT_WIDTH = AI_TRENDS_CARD_WIDTH - SHELL_PAD * 2 - CARD_PAD * 2;

function svgDataUri(svg: string): string {
  const withNamespace = svg.includes("xmlns=")
    ? svg
    : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;base64,${Buffer.from(withNamespace).toString("base64")}`;
}

/** An engine logo the page drew, without its Tailwind classes. */
function engineLogo(svg: string): string {
  return svgDataUri(svg.replace(CLASS_ATTRIBUTE, ""));
}

// Previews re-render on every theme switch; logos don't change between them.
const domainLogos = new Map<string, Promise<string | null>>();

function domainLogo(domain: string): Promise<string | null> {
  let logo = domainLogos.get(domain);
  if (!logo) {
    if (domainLogos.size >= AI_TRENDS_CARD_LOGO_CACHE_SIZE) {
      domainLogos.clear();
    }
    logo = fetchDomainLogo(domain);
    domainLogos.set(domain, logo);
  }
  return logo;
}

async function fetchDomainLogo(domain: string): Promise<string | null> {
  for (const url of getBrandLogoCandidates(domain)) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(AI_TRENDS_CARD_LOGO_TIMEOUT_MS),
      });
      const type = response.headers.get("content-type") ?? "";
      if (response.ok && type.startsWith("image/")) {
        const bytes = Buffer.from(await response.arrayBuffer());
        return `data:${type};base64,${bytes.toString("base64")}`;
      }
    } catch {
      // Try the next candidate; a card without a logo is still a card.
    }
  }
  return null;
}

function formatTick(format: AiTrendsShareCard["format"], value: number) {
  return format === "share" ? formatShareTick(value) : formatCountTick(value);
}

/** First and last day labels hug the plot edges instead of centering on them. */
function tickAlign(index: number, last: number) {
  if (index === 0) {
    return "flex-start";
  }
  return index === last ? "flex-end" : "center";
}

/** A lone series carries the brand color, like the headline marker. */
function seriesColor(
  item: AiTrendsShareCard["series"][number],
  card: AiTrendsShareCard,
  theme: Theme
): string {
  if (card.series.length === 1) {
    return theme.brand;
  }
  return card.theme === "dark" ? item.darkColor : item.color;
}

/** Smallest 1/2/2.5/5 × 10ⁿ step that fits `max` in `ticks` steps. */
function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return (
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * magnitude)
      .find((value) => value >= raw) ?? raw
  );
}

/** The y scale with the least empty space above the data, in 3–5 steps. */
function yScale(max: number): { max: number; ticks: number } {
  if (max <= 0) {
    return { max: 1, ticks: 4 };
  }
  return [4, 5, 3]
    .map((ticks) => ({ max: niceStep(max, ticks) * ticks, ticks }))
    .reduce((best, next) => (next.max < best.max ? next : best));
}

/**
 * Monotone cubic path (Fritsch–Carlson, like d3's curveMonotoneX and the
 * dashboard's `monotone` curve): smooth, but never overshoots a day's value.
 */
function monotonePath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) {
    return "";
  }
  const at = (index: number) => points[index] ?? [0, 0];
  if (n === 1) {
    const [x, y] = at(0);
    return `M${x} ${y}`;
  }
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = at(i);
    const [x1, y1] = at(i + 1);
    slopes.push((y1 - y0) / (x1 - x0));
  }
  const tangents = points.map((_, i) => {
    if (i === 0) {
      return slopes[0] ?? 0;
    }
    if (i === n - 1) {
      return slopes[n - 2] ?? 0;
    }
    const before = slopes[i - 1] ?? 0;
    const after = slopes[i] ?? 0;
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
  let path = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = at(i);
    const [x1, y1] = at(i + 1);
    const third = (x1 - x0) / 3;
    path += ` C${(x0 + third).toFixed(1)} ${(y0 + (tangents[i] ?? 0) * third).toFixed(1)} ${(x1 - third).toFixed(1)} ${(y1 - (tangents[i + 1] ?? 0) * third).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return path;
}

function Chart({
  card,
  series,
  theme,
  width,
  height,
}: {
  card: AiTrendsShareCard;
  series: CardSeries[];
  theme: Theme;
  width: number;
  height: number;
}) {
  const plotWidth = width - Y_AXIS_WIDTH;
  const plotHeight = height - X_AXIS_HEIGHT;
  const { max, ticks } = yScale(
    Math.max(...series.flatMap((item) => item.values), 0) * 1.04
  );
  const last = card.days.length - 1;
  const xOf = (index: number) => (index / Math.max(last, 1)) * plotWidth;
  const yOf = (value: number) => plotHeight - (value / max) * plotHeight;
  const xStep = Math.max(1, Math.round(last / (X_TICKS - 1)));
  // The last day always gets a label, so a regular tick too close to it drops.
  const xTicks = card.days.flatMap((day, index) =>
    index === last || (index % xStep === 0 && last - index >= xStep * 0.6)
      ? [{ day, index }]
      : []
  );
  const markIndex = card.markDay ? card.days.indexOf(card.markDay) : -1;
  const filled = series.length <= AI_TRENDS_MAX_FILLED_SERIES;
  // Overlapping fills muddy each other, so several series fill fainter.
  const fillAlpha =
    series.length === 1 ? AI_TRENDS_FILL_ALPHA : AI_TRENDS_FILL_ALPHA / 2.5;

  return (
    <div style={{ display: "flex", position: "relative", width, height }}>
      {markIndex >= 0 ? (
        <div
          style={{
            position: "absolute",
            top: 6,
            left: Y_AXIS_WIDTH + xOf(markIndex) + 12,
            display: "flex",
            fontSize: 17,
            color: theme.brand,
            fontFamily: "Geist",
            fontWeight: 700,
          }}
        >
          Last 7 days
        </div>
      ) : null}
      {Array.from({ length: ticks + 1 }, (_, tick) => (
        <div
          key={tick}
          style={{
            position: "absolute",
            left: 0,
            width: Y_AXIS_WIDTH - 18,
            top: yOf((max / ticks) * tick) - 11,
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 17,
            color: theme.muted,
          }}
        >
          {formatTick(card.format, (max / ticks) * tick)}
        </div>
      ))}
      {xTicks.map(({ day, index }) => (
        <div
          key={day}
          style={{
            position: "absolute",
            top: plotHeight + 16,
            left: Y_AXIS_WIDTH + xOf(index) - 60,
            width: 120,
            display: "flex",
            justifyContent: tickAlign(index, last),
            paddingLeft: index === 0 ? 60 : 0,
            paddingRight: index === last ? 60 : 0,
            fontSize: 17,
            color: theme.muted,
          }}
        >
          {formatChartDay(day)}
        </div>
      ))}
      <svg
        height={plotHeight + 8}
        style={{ position: "absolute", left: Y_AXIS_WIDTH, top: 0 }}
        viewBox={`0 0 ${plotWidth} ${plotHeight + 8}`}
        width={plotWidth}
      >
        <defs>
          {series.map((item, index) => (
            <linearGradient
              id={`fill${index}`}
              key={item.label}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={item.color}
                stopOpacity={fillAlpha}
              />
              <stop offset="100%" stopColor={item.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {markIndex >= 0 ? (
          <rect
            fill={theme.band}
            height={plotHeight}
            width={plotWidth - xOf(markIndex)}
            x={xOf(markIndex)}
            y={0}
          />
        ) : null}
        {Array.from({ length: ticks + 1 }, (_, tick) => {
          const y = yOf((max / ticks) * tick);
          return (
            <line
              key={tick}
              stroke={theme.grid}
              strokeWidth={1.5}
              x1={0}
              x2={plotWidth}
              y1={y}
              y2={y}
            />
          );
        })}
        {xTicks.map(({ day, index }) => (
          <circle
            cx={Math.min(Math.max(xOf(index), 3), plotWidth - 3)}
            cy={plotHeight + 4}
            fill={theme.tick}
            key={day}
            r={3}
          />
        ))}
        {series.map((item, index) => {
          const points = item.values.map((value, day): [number, number] => [
            xOf(day),
            yOf(value),
          ]);
          const line = monotonePath(points);
          const end = points.at(-1);
          return (
            <g key={item.label}>
              {filled ? (
                <path
                  d={`${line} L${plotWidth} ${plotHeight} L0 ${plotHeight} Z`}
                  fill={`url(#fill${index})`}
                />
              ) : null}
              <path
                d={line}
                fill="none"
                stroke={item.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={series.length === 1 ? 4 : 3}
              />
              {end ? (
                <circle
                  cx={end[0]}
                  cy={end[1]}
                  fill={item.color}
                  r={7}
                  stroke={theme.card}
                  strokeWidth={3}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Rounded rect with superellipse corners, the curve CSS `corner-shape:
 * squircle` draws (exponent 4). Satori has no corner-shape, so pills paint it.
 */
function squirclePath(width: number, height: number, radius: number): string {
  const steps = 12;
  const corner = (cx: number, cy: number, from: number) =>
    Array.from({ length: steps + 1 }, (_, step) => {
      const angle = from + (step / steps) * (Math.PI / 2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = cx + radius * Math.sign(cos) * Math.abs(cos) ** 0.5;
      const y = cy + radius * Math.sign(sin) * Math.abs(sin) ** 0.5;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
  const points = [
    ...corner(width - radius, height - radius, 0),
    ...corner(radius, height - radius, Math.PI / 2),
    ...corner(radius, radius, Math.PI),
    ...corner(width - radius, radius, (3 * Math.PI) / 2),
  ];
  return `M${points.join(" L")} Z`;
}

/** Geist Bold advance widths at 1px, for the few glyphs a delta uses. */
function pillTextWidth(text: string, size: number): number {
  let width = 0;
  for (const char of text) {
    if (char === "%") {
      width += 0.86;
    } else if (char === ".") {
      width += 0.28;
    } else {
      width += 0.6;
    }
  }
  return width * size;
}

const PILL_HEIGHT = 40;
const PILL_FONT = 22;
const PILL_ICON = 18;
const PILL_GAP = 6;
const PILL_PAD = 15;

function TrendPill({ change, theme }: { change: number; theme: Theme }) {
  const up = change >= 0;
  const text = formatChangeAmount(change);
  const width = Math.round(
    PILL_PAD * 2 + PILL_ICON + PILL_GAP + pillTextWidth(text, PILL_FONT)
  );
  const color = up ? theme.up : theme.down;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        gap: PILL_GAP,
        width,
        height: PILL_HEIGHT,
        color,
        fontFamily: "Geist",
        fontWeight: 700,
        fontSize: PILL_FONT,
      }}
    >
      <svg
        height={PILL_HEIGHT}
        style={{ position: "absolute", left: 0, top: 0 }}
        viewBox={`0 0 ${width} ${PILL_HEIGHT}`}
        width={width}
      >
        <path
          d={squirclePath(width, PILL_HEIGHT, PILL_HEIGHT / 2)}
          fill={up ? theme.upSoft : theme.downSoft}
        />
      </svg>
      <svg height={PILL_ICON} viewBox="0 0 18 18" width={PILL_ICON}>
        <path
          d={up ? "M4 14 L14 4 M7 4 H14 V11" : "M4 4 L14 14 M7 14 H14 V7"}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.4}
        />
      </svg>
      {text}
    </div>
  );
}

/**
 * One headline word, or the domain the headline names drawn after its
 * favicon. Words keep trailing punctuation like "'s" attached.
 */
function TitleWord({
  word,
  domain,
  favicon,
  size,
  theme,
}: {
  word: string;
  domain: string | undefined;
  favicon: string | null;
  size: number;
  theme: Theme;
}) {
  if (!(domain && favicon && word.startsWith(domain))) {
    return <span>{word}</span>;
  }
  const tile = Math.round(size * 0.86);
  return (
    <span style={{ display: "flex", alignItems: "center" }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: tile,
          height: tile,
          marginRight: Math.round(size * 0.2),
          borderRadius: Math.round(tile * 0.26),
          // Favicons are drawn for light surfaces, so their tile stays light.
          background: "#FFFFFF",
          border: `1.5px solid ${theme.cardBorder}`,
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: satori draws plain img */}
        <img
          alt=""
          height={Math.round(tile * 0.68)}
          src={favicon}
          width={Math.round(tile * 0.68)}
        />
      </span>
      {word}
    </span>
  );
}

function titleWords(text: string): string[] {
  return text.split(" ").filter((word) => word.length > 0);
}

export async function renderShareCard(card: AiTrendsShareCard) {
  const theme = AI_TRENDS_CARD_THEMES[card.theme];
  const [body, bold, icons, favicon] = await Promise.all([
    loadRenderFont("Inter"),
    loadRenderFont("Geist:wght@700"),
    Promise.all(
      card.icons.map((icon) =>
        icon.kind === "engine" ? engineLogo(icon.svg) : domainLogo(icon.value)
      )
    ),
    // The eyebrow already shows the domain's logo when the card is about it.
    card.title.domain &&
    !card.icons.some(
      (icon) => icon.kind === "domain" && icon.value === card.title.domain
    )
      ? domainLogo(card.title.domain)
      : null,
  ]);
  const logos = icons.filter((icon) => icon !== null);
  const seriesLogos = card.series.map((item) =>
    item.logo ? engineLogo(item.logo) : null
  );
  const series: CardSeries[] = card.series.map((item) => ({
    label: item.label,
    color: seriesColor(item, card, theme),
    values: item.values,
  }));
  const mark = svgDataUri(notraMarkSvg(NOTRA_MARK_STROKE));
  const lead = card.stats[0];
  const legend = series.length > 1;

  const titleLength =
    card.title.before.length +
    card.title.highlight.length +
    card.title.after.length;
  let titleSize = 58;
  if (titleLength > 50) {
    titleSize = 42;
  } else if (titleLength > 40) {
    titleSize = 50;
  }
  // The headline wraps between words, so reserve every line it takes.
  const titleLines = Math.max(
    1,
    Math.ceil((titleLength * titleSize * TITLE_CHAR_WIDTH) / CONTENT_WIDTH)
  );
  const descriptionLines = Math.min(
    2,
    Math.max(1, Math.ceil(card.description.length / DESCRIPTION_LINE_CHARS))
  );
  const cardHeight = AI_TRENDS_CARD_HEIGHT - SHELL_PAD * 2 - TOP_BAR;
  const chartHeight =
    cardHeight -
    CARD_PAD * 2 -
    44 -
    TITLE_GAP -
    titleLines * Math.round(titleSize * 1.15) -
    16 -
    descriptionLines * DESCRIPTION_LINE_HEIGHT -
    (card.stats.length > 0 ? STATS_GAP + 92 : 0) -
    28 -
    (legend ? 52 : 0);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: SHELL_PAD,
        paddingTop: 0,
        background: theme.shell,
        color: theme.text,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: TOP_BAR + SHELL_PAD - 8,
          paddingTop: SHELL_PAD - 8,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {theme.markTile ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 42,
                height: 42,
                borderRadius: 11,
                background: "#FFFFFF",
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: satori draws plain img */}
              <img alt="" height={30} src={mark} width={30} />
            </div>
          ) : (
            // biome-ignore lint/performance/noImgElement: satori draws plain img
            <img alt="" height={34} src={mark} width={34} />
          )}
          <span
            style={{
              display: "flex",
              fontFamily: "Geist",
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: -0.8,
            }}
          >
            Notra
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 22,
              lineHeight: 1,
              color: theme.muted,
              marginLeft: 6,
            }}
          >
            AI Search Trends
          </span>
        </div>
        <span style={{ fontSize: 20, lineHeight: 1, color: theme.muted }}>
          {`${formatChartDay(card.days[0] ?? "")} – ${formatChartDay(card.days.at(-1) ?? "")}`}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          marginTop: 8,
          padding: CARD_PAD,
          borderRadius: 28,
          background: theme.card,
          border: `1.5px solid ${theme.cardBorder}`,
          boxShadow: theme.shadow,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 44,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logos.length > 0 ? (
              <div style={{ display: "flex" }}>
                {logos.map((src, index) => (
                  <div
                    key={src.slice(-32)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      marginLeft: index === 0 ? 0 : -10,
                      borderRadius: 12,
                      // Engine marks are drawn for light surfaces, so their tile stays light.
                      background: "#FFFFFF",
                      border: `1.5px solid ${theme.cardBorder}`,
                    }}
                  >
                    {/* biome-ignore lint/performance/noImgElement: satori draws plain img */}
                    <img alt="" height={26} src={src} width={26} />
                  </div>
                ))}
              </div>
            ) : null}
            <span style={{ fontSize: 22, color: theme.muted }}>
              {card.eyebrow}
            </span>
          </div>
          {lead && lead.change !== null ? (
            <TrendPill change={lead.change} theme={theme} />
          ) : null}
        </div>
        {/* Word by word, so every gap is one space wide and lines break between words. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            columnGap: Math.round(titleSize * 0.24),
            marginTop: TITLE_GAP,
            fontFamily: "Geist",
            fontWeight: 700,
            fontSize: titleSize,
            letterSpacing: -titleSize * 0.028,
            lineHeight: 1.15,
          }}
        >
          {titleWords(card.title.before).map((word, index) => (
            <TitleWord
              domain={card.title.domain}
              favicon={favicon}
              key={`before-${index.toString()}`}
              size={titleSize}
              theme={theme}
              word={word}
            />
          ))}
          <span
            style={{
              whiteSpace: "pre",
              color: theme.brand,
              background: theme.marker,
              borderRadius: 14,
              padding: "0 12px",
              // Pulls the neighbouring words in so the pill's padding doesn't
              // double the gap, but never past the card's text edge.
              marginLeft: card.title.before.trim() ? -4 : 0,
              marginRight: card.title.after.trim() ? -4 : 0,
            }}
          >
            {card.title.highlight}
          </span>
          {titleWords(card.title.after).map((word, index) => (
            <TitleWord
              domain={card.title.domain}
              favicon={favicon}
              key={`after-${index.toString()}`}
              size={titleSize}
              theme={theme}
              word={word}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 22,
            lineHeight: `${DESCRIPTION_LINE_HEIGHT}px`,
            height: descriptionLines * DESCRIPTION_LINE_HEIGHT,
            overflow: "hidden",
            color: theme.muted,
            maxWidth: 1300,
          }}
        >
          {card.description}
        </div>
        {card.stats.length > 0 ? (
          <div style={{ display: "flex", marginTop: STATS_GAP, height: 92 }}>
            {card.stats.map((stat, index) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingLeft: index === 0 ? 0 : 36,
                  paddingRight: 36,
                  borderLeft:
                    index === 0 ? "none" : `1.5px solid ${theme.cardBorder}`,
                }}
              >
                <span style={{ fontSize: 19, color: theme.muted }}>
                  {stat.label}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Geist",
                      fontWeight: 700,
                      fontSize: 46,
                      letterSpacing: -1.2,
                    }}
                  >
                    {stat.value}
                  </span>
                  {index > 0 && stat.change !== null ? (
                    <TrendPill change={stat.change} theme={theme} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", height: 28 }} />
        <Chart
          card={card}
          height={chartHeight}
          series={series}
          theme={theme}
          width={CONTENT_WIDTH}
        />
        {legend ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 30,
              marginTop: 18,
            }}
          >
            {series.map((item, index) => (
              <div
                key={item.label}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: item.color,
                  }}
                />
                {seriesLogos[index] ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "#FFFFFF",
                      border: `1.5px solid ${theme.cardBorder}`,
                    }}
                  >
                    {/* biome-ignore lint/performance/noImgElement: satori draws plain img */}
                    <img
                      alt=""
                      height={18}
                      src={seriesLogos[index] ?? ""}
                      width={18}
                    />
                  </div>
                ) : null}
                <span style={{ fontSize: 20, color: theme.text }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    {
      width: AI_TRENDS_CARD_WIDTH,
      height: AI_TRENDS_CARD_HEIGHT,
      fonts: [
        { name: "Inter", data: body, weight: 400, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
    }
  );
}
