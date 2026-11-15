import "server-only";
import { db } from "@notra/db/drizzle";
import { demoSandboxes, geoMentionChecks, projects } from "@notra/db/schema";
import type { Database } from "@notra/db/types/database";
import { GEO_AI_OVERVIEW_ABSENT_ANSWER } from "@notra/geo-core/constants/geo-ai-overview";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { type SQL, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import {
  AI_TRENDS_BASELINE_DAYS,
  AI_TRENDS_CACHE_SECONDS,
  AI_TRENDS_DEFAULT_DOMAIN,
  AI_TRENDS_HOST_PREFIXES,
  AI_TRENDS_IGNORED_DOMAINS,
  AI_TRENDS_OVERVIEW_ENGINES,
  AI_TRENDS_DOMAIN_STAT_PERIODS,
  AI_TRENDS_TOP_ADVERTISERS,
  AI_TRENDS_TOP_DOMAINS,
} from "@/constants/ai-trends";
import type {
  AiTrendsAdvertiser,
  AiTrendsAnomaly,
  AiTrendsDays,
  AiTrendsDomainDay,
  AiTrendsDomainPeriodRow,
  AiTrendsDomainShare,
  AiTrendsEngine,
  AiTrendsEngineDay,
  AiTrendsEnginePeriodRow,
  AiTrendsOverview,
  AiTrendsPeriodTotals,
  AiTrendsTopDomain,
  AiTrendsWindow,
} from "@/types/ai-trends";
import {
  addDays,
  aiTrendsEngineLabel,
  aiTrendsEngineName,
  dayRange,
  detectAnomalies,
  domainShareSeries,
  engineMetricSeries,
  trendsWindow,
} from "@/utils/ai-trends";

/** An engine's domain below this across both periods only bloats the anomaly scan. */
const MIN_PERIOD_DOMAIN_ROWS = 5;

/** Sort and hash memory for one overview, enough for 90 days in memory. */
const WORK_MEM = "256MB";

type Period = "recent" | "baseline";

type Executor = Pick<Database, "execute">;

/** `db.execute` wants an index signature that interfaces don't carry. */
type SqlRow<T> = T & Record<string, unknown>;

interface PeriodSqlRow extends AiTrendsPeriodTotals {
  row_kind: "engine" | "domain";
  engine: string;
  domain: string | null;
  period: Period;
}

interface TopDomainSqlRow {
  domain: string;
  citations: number;
  engines: number;
  recentTotal: number;
  matchedRecent: number;
  matchedBaseline: number;
  matchedRecentTotal: number;
  matchedBaselineTotal: number;
}

interface DomainDaySqlRow {
  day: string;
  engine: string;
  domain: string;
  citations: number;
}

const EMPTY_TOTALS: AiTrendsPeriodTotals = {
  answers: 0,
  citedAnswers: 0,
  citations: 0,
  queries: 0,
  queriesSquared: 0,
  searchedAnswers: 0,
  overviewAnswers: 0,
  overviewAbsent: 0,
  adReported: 0,
  adShown: 0,
  productReported: 0,
  productShown: 0,
};

/** One overview's checks, filled once and dropped when its transaction ends. */
const CHECKS_TABLE = sql.raw("ai_trends_checks");
/** Their citations counted per day, engine and domain, likewise. */
const CITES_TABLE = sql.raw("ai_trends_cites");

const ignoredDomains = sql`${sql.param([...AI_TRENDS_IGNORED_DOMAINS])}::text[]`;
const overviewEngines = sql`${sql.param([...AI_TRENDS_OVERVIEW_ENGINES])}::text[]`;

function jsonArray(value: SQL) {
  return sql`case when jsonb_typeof(${value}) = 'array' then ${value} else '[]'::jsonb end`;
}

/** The `AI_TRENDS_HOST_PREFIXES` a host starts with, dropped. */
const hostWithoutPrefix = sql`case ${sql.join(
  AI_TRENDS_HOST_PREFIXES.map(
    (prefix) =>
      sql`when starts_with(host, ${`${prefix}.`}) then substr(host, ${prefix.length + 2})`
  ),
  sql` `
)} else host end`;

/**
 * Domains of the distinct URLs a check cited, one entry per URL. API engines
 * split what they cited (`sources`) from what they retrieved (`grounding`);
 * both count, the same way the dashboard's source lists count them.
 *
 * The host is what `^scheme://([^/:?#]+)` captures, cut out with string
 * functions: a regex per URL under the database collation cost more than
 * everything else in these queries together. The scheme regex only runs for
 * URLs that aren't plain http(s). Only lowercasing needs the database
 * collation; everything else compares bytewise under `C`.
 */
const checkDomains = sql`
  select domain from (
    select ${hostWithoutPrefix} as domain
    from (
      -- rtrim folds example.com. into example.com.
      select rtrim(lower(
        split_part(split_part(split_part(split_part(
          split_part(url, '://', 2), '/', 1), '?', 1), '#', 1), ':', 1)
        collate "default"
      ) collate "C", '.') as host
      from (
        select distinct url from (
          select value->>'url' collate "C" as url
          from jsonb_array_elements(${jsonArray(sql`${geoMentionChecks.grounding}->'sources'`)})
          union all
          select value->>'url' collate "C" as url
          from jsonb_array_elements(${jsonArray(sql`${geoMentionChecks.sources}`)})
        ) urls
      ) urls
      where starts_with(url, 'https://')
        or starts_with(url, 'http://')
        or url ~ '^[a-zA-Z][a-zA-Z0-9+.-]*://'
      -- These fences keep Postgres from inlining the host into every
      -- expression and filter above, which computed it a dozen times per URL.
      offset 0
    ) hosts
    offset 0
  ) domains
  where domain <> '' and domain <> all(${ignoredDomains})
    -- Loopback, LAN names and raw IPs, which getReferenceDomain drops
    -- for new checks. Older checks still store them.
    and domain like '%.%'
    and domain !~ '^[0-9.]+$|[.](localhost|localdomain|local|internal|test|invalid|onion|home[.]arpa)$'
`;

/**
 * Tracked single prompts captured in `[from, toExclusive)` across every
 * customer, with their cited domains. Personas and follow-up turns ask
 * different questions, and demo sandboxes and sample projects hold generated
 * answers, so all of them would skew engine behaviour.
 *
 * With `periods`, checks from the anomaly periods are marked `recent` or
 * `baseline`, and `matched` when their engine asked the same prompt in both.
 * Prompt ids repeat across projects (auto prompts share slugs), so a prompt
 * is its project, id and language together.
 */
function checksQuery(
  from: string,
  toExclusive: string,
  periods?: { baselineFrom: string; recentFrom: string }
) {
  const period = periods
    ? sql`case
        when ${geoMentionChecks.capturedAt} >= ${periods.recentFrom}::timestamp then 'recent'
        when ${geoMentionChecks.capturedAt} >= ${periods.baselineFrom}::timestamp then 'baseline'
      end`
    : sql`null::text`;
  const checks = sql`
    select
      ${geoMentionChecks.id} as id,
      ${geoMentionChecks.engine} collate "C" as engine,
      ${geoMentionChecks.projectId} collate "C" as project_id,
      ${geoMentionChecks.promptId} collate "C" as prompt_id,
      ${geoMentionChecks.language} collate "C" as language,
      to_char(${geoMentionChecks.capturedAt}, 'YYYY-MM-DD') collate "C" as day,
      ${period} as period,
      ${geoMentionChecks.answer} = ${GEO_AI_OVERVIEW_ABSENT_ANSWER} as absent,
      ${geoMentionChecks.engine} = any(${overviewEngines}) as overview_engine,
      jsonb_array_length(${jsonArray(sql`${geoMentionChecks.grounding}->'queries'`)}) as queries,
      jsonb_typeof(${geoMentionChecks.surfaces}->'ads') = 'array' as ads_reported,
      jsonb_array_length(${jsonArray(sql`${geoMentionChecks.surfaces}->'ads'`)}) > 0 as ads_shown,
      jsonb_typeof(${geoMentionChecks.surfaces}->'products') = 'array'
        or jsonb_typeof(${geoMentionChecks.surfaces}->'shoppingCards') = 'number' as products_reported,
      jsonb_array_length(${jsonArray(sql`${geoMentionChecks.surfaces}->'products'`)}) > 0
        or coalesce((${geoMentionChecks.surfaces}->>'shoppingCards')::int, 0) > 0 as products_shown,
      case
        when jsonb_typeof(${geoMentionChecks.surfaces}->'ads') = 'array'
        then ${geoMentionChecks.surfaces}->'ads'
      end as ads,
      array(${checkDomains}) as domains
    from ${geoMentionChecks}
    where ${geoMentionChecks.capturedAt} >= ${from}::timestamp
      and ${geoMentionChecks.capturedAt} < ${toExclusive}::timestamp
      and ${geoMentionChecks.turn} = 0
      and ${geoMentionChecks.sequenceId} is null
      and ${geoMentionChecks.personaId} is null
      and ${geoMentionChecks.organizationId} not in (
        select ${demoSandboxes.organizationId} from ${demoSandboxes}
        where ${demoSandboxes.organizationId} is not null
      )
      and not exists (
        select 1 from ${projects}
        where ${projects.id} = ${geoMentionChecks.projectId}
          and ${projects.isSample}
      )
  `;
  if (!periods) {
    return checks;
  }
  return sql`
    select
      c.*,
      c.period is not null
        and bool_or(c.period = 'recent') over pair
        and bool_or(c.period = 'baseline') over pair as matched
    -- Without the fence the domains are parsed after the pairing sort, which
    -- then has to carry every check's raw citations.
    from (${checks} offset 0) c
    window pair as (partition by c.engine, c.project_id, c.prompt_id, c.language)
  `;
}

const engineTotals = sql`
  (count(*) filter (where not ch.absent))::int as "answers",
  (count(*) filter (where cardinality(ch.domains) > 0))::int as "citedAnswers",
  coalesce(sum(cardinality(ch.domains)), 0)::int as "citations",
  coalesce(sum(ch.queries) filter (where ch.queries > 0), 0)::int as "queries",
  (count(*) filter (where ch.queries > 0))::int as "searchedAnswers",
  (count(*) filter (where ch.overview_engine))::int as "overviewAnswers",
  (count(*) filter (where ch.overview_engine and ch.absent))::int as "overviewAbsent",
  (count(*) filter (where ch.ads_reported))::int as "adReported",
  (count(*) filter (where ch.ads_shown))::int as "adShown",
  (count(*) filter (where ch.products_reported))::int as "productReported",
  (count(*) filter (where ch.products_shown))::int as "productShown"
`;

async function resolveWindow(days: AiTrendsDays): Promise<AiTrendsWindow> {
  const result = await db.execute<{ last: string | null }>(sql`
    select to_char(max(${geoMentionChecks.capturedAt}), 'YYYY-MM-DD') as last
    from ${geoMentionChecks}
    where ${geoMentionChecks.capturedAt} >= now() - make_interval(days => ${days})
  `);
  const today = todayIsoDate();
  const last = result.rows[0]?.last ?? null;
  // Today is still filling up, so end at the last complete day with data.
  return trendsWindow(
    last && addDays(last, 1) < today ? addDays(last, 1) : today,
    days
  );
}

async function getEngineDays(tx: Executor, window: AiTrendsWindow) {
  const result = await tx.execute<SqlRow<AiTrendsEngineDay>>(sql`
    select ch.day, ch.engine, ${engineTotals}
    from ${CHECKS_TABLE} ch
    where ch.day >= ${window.from}
    group by ch.day, ch.engine
    order by ch.day
  `);
  return result.rows;
}

/**
 * Period totals for prompts each engine answered in both anomaly periods.
 * Engine rows carry the totals, domain rows only `citations`.
 */
async function getPeriodRows(tx: Executor) {
  const result = await tx.execute<SqlRow<PeriodSqlRow>>(sql`
    select
      'engine' as row_kind,
      ch.engine,
      null as domain,
      ch.period,
      ${engineTotals},
      coalesce(sum(ch.queries::float8 ^ 2) filter (where ch.queries > 0), 0)::float8 as "queriesSquared"
    from ${CHECKS_TABLE} ch
    where ch.matched
    group by ch.engine, ch.period
    union all
    select
      'domain', engine, domain, period,
      0, 0, citations, 0, 0, 0, 0, 0, 0, 0, 0, 0
    from (
      select
        engine,
        domain,
        period,
        sum(citations)::int as citations,
        sum(sum(citations)) over (partition by engine, domain) as pair_total
      from ${CITES_TABLE}
      where matched
      group by engine, domain, period
    ) pairs
    -- Thresholding both periods together keeps a thin side's real count.
    where pair_total >= ${MIN_PERIOD_DOMAIN_ROWS}
  `);
  return result.rows;
}

/** Who bought ads in consumer AI answers, by answers carrying their ad. */
async function getAdvertisers(tx: Executor, window: AiTrendsWindow) {
  const result = await tx.execute<SqlRow<AiTrendsAdvertiser>>(sql`
    with checks as (
      select * from ${CHECKS_TABLE} where ads_reported and day >= ${window.from}
    ),
    ads as (
      select distinct
        ch.id,
        ch.engine,
        coalesce(ad->>'domain', lower(ad->>'brand')) as advertiser,
        ad->>'brand' as brand
      from checks ch
      cross join lateral jsonb_array_elements(ch.ads) ad
    )
    select
      advertiser,
      mode() within group (order by brand) as brand,
      count(distinct id)::int as answers,
      (count(distinct id)::float8 / nullif((select count(*) from checks), 0)) as share,
      array_agg(distinct engine) as engines
    from ads
    where advertiser is not null
    group by advertiser
    order by answers desc
    limit ${AI_TRENDS_TOP_ADVERTISERS}
  `);
  return result.rows.map((row) => ({
    ...row,
    share: row.share ?? 0,
    engines: row.engines.map(aiTrendsEngineLabel),
  }));
}

async function getDomainDays(
  tx: Executor,
  window: AiTrendsWindow,
  domains: string[]
) {
  if (domains.length === 0) {
    return [];
  }
  const result = await tx.execute<SqlRow<DomainDaySqlRow>>(sql`
    select day, engine, domain, sum(citations)::int as citations
    from ${CITES_TABLE}
    where day >= ${window.from}
      and domain = any(${sql.param(domains)}::text[])
    group by day, engine, domain
  `);
  return result.rows;
}

function splitPeriods(rows: PeriodSqlRow[]) {
  const engines = new Map<string, AiTrendsEnginePeriodRow>();
  const domains = new Map<string, AiTrendsDomainPeriodRow>();
  for (const row of rows) {
    if (row.row_kind === "engine") {
      const entry = engines.get(row.engine) ?? {
        engine: row.engine,
        recent: EMPTY_TOTALS,
        baseline: EMPTY_TOTALS,
      };
      const { row_kind, engine, domain, period, ...totals } = row;
      entry[period] = totals;
      engines.set(row.engine, entry);
      continue;
    }
    if (!row.domain) {
      continue;
    }
    const key = `${row.engine}\u0000${row.domain}`;
    const entry = domains.get(key) ?? {
      engine: row.engine,
      domain: row.domain,
      recent: 0,
      baseline: 0,
    };
    entry[row.period] = row.citations;
    domains.set(key, entry);
  }
  return { engines: [...engines.values()], domains: [...domains.values()] };
}

function summarizeEngines(engineDays: AiTrendsEngineDay[]): AiTrendsEngine[] {
  const engines = new Map<string, AiTrendsEngine>();
  for (const row of engineDays) {
    const entry = engines.get(row.engine) ?? {
      id: row.engine,
      label: aiTrendsEngineLabel(row.engine),
      answers: 0,
      citations: 0,
      searchedAnswers: 0,
      overviewAnswers: 0,
      adReported: 0,
      productReported: 0,
    };
    entry.answers += row.answers;
    entry.citations += row.citations;
    entry.searchedAnswers += row.searchedAnswers;
    entry.overviewAnswers += row.overviewAnswers;
    entry.adReported += row.adReported;
    entry.productReported += row.productReported;
    engines.set(row.engine, entry);
  }
  return [...engines.values()].sort(
    (a, b) => b.citations - a.citations || b.answers - a.answers
  );
}

/**
 * The most cited domains in the recent period across every eligible check,
 * not just the matched prompts the anomalies compare, so newly tracked
 * prompts count too.
 */
async function getTopDomains(tx: Executor): Promise<AiTrendsTopDomain[]> {
  const result = await tx.execute<SqlRow<TopDomainSqlRow>>(sql`
    with cites as (
      select * from ${CITES_TABLE} where period is not null
    ),
    -- The change compares prompts asked in both periods, like the anomalies,
    -- so a customer adding prompts doesn't read as a domain taking off.
    totals as (
      select
        coalesce(sum(citations) filter (where period = 'recent'), 0)::int as recent,
        coalesce(sum(citations) filter (where matched and period = 'recent'), 0)::int as matched_recent,
        coalesce(sum(citations) filter (where matched and period = 'baseline'), 0)::int as matched_baseline
      from cites
    ),
    top as (
      select domain, sum(citations)::int as citations, count(distinct engine)::int as engines
      from cites
      where period = 'recent'
      group by domain
      order by citations desc
      limit ${AI_TRENDS_TOP_DOMAINS}
    ),
    before as (
      select
        domain,
        coalesce(sum(citations) filter (where period = 'recent'), 0)::int as recent,
        coalesce(sum(citations) filter (where period = 'baseline'), 0)::int as baseline
      from cites
      where matched and domain in (select domain from top)
      group by domain
    )
    select
      top.domain,
      top.citations,
      top.engines,
      totals.recent as "recentTotal",
      coalesce(before.recent, 0) as "matchedRecent",
      coalesce(before.baseline, 0) as "matchedBaseline",
      totals.matched_recent as "matchedRecentTotal",
      totals.matched_baseline as "matchedBaselineTotal"
    from top
    cross join totals
    left join before using (domain)
    order by top.citations desc
  `);
  return result.rows.map((row) => ({
    domain: row.domain,
    citations: row.citations,
    engines: row.engines,
    share: row.recentTotal > 0 ? row.citations / row.recentTotal : 0,
    matchedShare:
      row.matchedRecentTotal > 0
        ? row.matchedRecent / row.matchedRecentTotal
        : 0,
    baselineShare:
      row.matchedBaselineTotal > 0
        ? row.matchedBaseline / row.matchedBaselineTotal
        : 0,
  }));
}

/**
 * Stat tiles compare each period with the one before it, so a domain's share
 * reads back far enough for the longest one's comparison as well as the chart.
 */
function domainShareFrom(window: AiTrendsWindow, days: AiTrendsDays) {
  return addDays(
    window.toExclusive,
    -Math.max(days, 2 * Math.max(...AI_TRENDS_DOMAIN_STAT_PERIODS))
  );
}

/**
 * A domain's citations per day and engine out of `cites` (day, engine,
 * domain, citations). Every engine counts, citing the domain or not: "all
 * engines" divides by all citations.
 */
async function getDomainShareDays(
  executor: Executor,
  cites: SQL,
  domain: string
) {
  const result = await executor.execute<SqlRow<AiTrendsDomainDay>>(sql`
    select
      day,
      engine,
      coalesce(sum(citations) filter (where domain = ${domain}), 0)::int as citations,
      sum(citations)::int as total
    from (${cites}) cites
    group by day, engine
  `);
  return result.rows;
}

/**
 * Reads the window's checks and their cited domains once into temporary
 * tables; every section aggregates those instead of parsing the citations
 * again.
 */
function readOverviewRows(window: AiTrendsWindow, days: AiTrendsDays) {
  const baselineFrom = addDays(window.recentFrom, -AI_TRENDS_BASELINE_DAYS);
  // Reaches back at least as far as the window and the anomaly periods.
  const shareFrom = domainShareFrom(window, days);
  return db.transaction(async (tx) => {
    // The pairing sort and the domain counts spill to disk at the default.
    await tx.execute(sql`select set_config('work_mem', ${WORK_MEM}, true)`);
    await tx.execute(sql`
      create temporary table ${CHECKS_TABLE} on commit drop as
      ${checksQuery(shareFrom, window.toExclusive, {
        baselineFrom,
        recentFrom: window.recentFrom,
      })}
    `);
    await tx.execute(sql`
      create temporary table ${CITES_TABLE} on commit drop as
      select ch.day, ch.engine, ch.period, ch.matched, d.domain, count(*) as citations
      from ${CHECKS_TABLE} ch
      cross join unnest(ch.domains) d(domain)
      group by ch.day, ch.engine, ch.period, ch.matched, d.domain
    `);
    const engineDays = await getEngineDays(tx, window);
    const advertisers = await getAdvertisers(tx, window);
    const topDomains = await getTopDomains(tx);
    const candidates = detectAnomalies(splitPeriods(await getPeriodRows(tx)));
    const domainRows = await getDomainDays(tx, window, [
      ...new Set(
        candidates.flatMap((item) => (item.domain ? [item.domain] : []))
      ),
    ]);
    const shareDays = await getDomainShareDays(
      tx,
      sql`select day, engine, domain, citations from ${CITES_TABLE} where day >= ${shareFrom}`,
      AI_TRENDS_DEFAULT_DOMAIN
    );
    return {
      engineDays,
      advertisers,
      topDomains,
      candidates,
      domainRows,
      shareDays,
    };
  });
}

async function computeOverview(days: AiTrendsDays): Promise<AiTrendsOverview> {
  const window = await resolveWindow(days);
  const {
    engineDays,
    advertisers,
    topDomains,
    candidates,
    domainRows,
    shareDays,
  } = await readOverviewRows(window, days);
  const domainCitations = new Map(
    domainRows.map((row) => [
      `${row.engine}\u0000${row.day}\u0000${row.domain}`,
      row.citations,
    ])
  );
  const range = dayRange(window.from, window.toExclusive);

  const anomalies: AiTrendsAnomaly[] = candidates.map((candidate) => {
    const id = [candidate.kind, candidate.engine, candidate.domain ?? ""].join(
      ":"
    );
    const series =
      candidate.kind === "domainShare"
        ? // Days the engine cited other domains but not this one are 0%, not gaps.
          domainShareSeries(
            engineDays
              .filter((row) => row.engine === candidate.engine)
              .map((row) => ({
                day: row.day,
                engine: row.engine,
                citations:
                  domainCitations.get(
                    `${row.engine}\u0000${row.day}\u0000${candidate.domain}`
                  ) ?? 0,
                total: row.citations,
              })),
            candidate.engine,
            range
          )
        : engineMetricSeries(
            engineDays,
            candidate.engine,
            candidate.kind,
            range
          );
    return {
      ...candidate,
      id,
      engineLabel: aiTrendsEngineLabel(candidate.engine),
      subject: aiTrendsEngineName(candidate.engine).name,
      series,
    };
  });

  const engines = summarizeEngines(engineDays);
  return {
    window,
    engines,
    engineDays,
    anomalies,
    topDomains,
    advertisers,
    answers: engines.reduce((sum, engine) => sum + engine.answers, 0),
    citations: engines.reduce((sum, engine) => sum + engine.citations, 0),
    defaultDomainShare: {
      domain: AI_TRENDS_DEFAULT_DOMAIN,
      window,
      days: shareDays,
    },
  };
}

async function computeDomainShare(
  days: AiTrendsDays,
  domain: string
): Promise<AiTrendsDomainShare> {
  const window = await resolveWindow(days);
  const rows = await getDomainShareDays(
    db,
    sql`
      select ch.day, ch.engine, d.domain, 1 as citations
      from (${checksQuery(domainShareFrom(window, days), window.toExclusive)}) ch
      cross join unnest(ch.domains) d(domain)
    `,
    domain
  );
  return { domain, window, days: rows };
}

export const getAiTrendsOverview = unstable_cache(
  computeOverview,
  ["console", "ai-trends", "overview"],
  { revalidate: AI_TRENDS_CACHE_SECONDS }
);

export const getAiTrendsDomainShare = unstable_cache(
  computeDomainShare,
  ["console", "ai-trends", "domain-share"],
  { revalidate: AI_TRENDS_CACHE_SECONDS }
);
