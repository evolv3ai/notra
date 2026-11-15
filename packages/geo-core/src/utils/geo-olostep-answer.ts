import {
  GEO_CHECK_GROUNDING_MAX_QUERIES,
  GEO_CHECK_GROUNDING_MAX_SOURCES,
  GEO_CHECK_SURFACE_MAX_ADS,
  GEO_CHECK_SURFACE_MAX_PRODUCTS,
  GEO_CHECK_SURFACE_MAX_RELATED_QUERIES,
  GEO_CHECK_SURFACE_MAX_VENDORS,
} from "@notra/db/constants/geo-checks";
import type {
  GeoCheckSource,
  GeoCheckSurfaces,
} from "@notra/db/types/geo-checks";

import { GEO_OLOSTEP_NO_AI_OVERVIEW_MESSAGE } from "../constants/geo-olostep";
import type { GeoEngineAnswer } from "../types/geo";
import type {
  GeoOlostepAnswerPayload,
  GeoOlostepSource,
} from "../types/geo-olostep";
import { getReferenceDomain } from "./reference-display";

function uniqueSources(sources: readonly GeoOlostepSource[]): GeoCheckSource[] {
  const seen = new Set<string>();
  const result: GeoCheckSource[] = [];
  for (const source of sources) {
    const domain = getReferenceDomain(source.url);
    if (!domain || seen.has(source.url)) {
      continue;
    }
    seen.add(source.url);
    const title = source.title || source.label || source.text || domain;
    result.push({ title, url: source.url, domain });
  }
  return result.slice(0, GEO_CHECK_GROUNDING_MAX_SOURCES);
}

// The first number only, so "$10 – $20" reads 10; spaces may group thousands.
const PRICE_NUMBER = /\d(?:[\d.,]|[\s\u00a0\u202f](?=\d{3}(?!\d)))*/;
const PRICE_SPACES = /[\s\u00a0\u202f]/g;
const SEPARATORS = /[.,]/g;
const DECIMAL_TAIL = /[.,](\d{1,2})$/;

/**
 * Reads "$1,299.00", "12,99 €", "1.299,00" and "1 299 €" alike: whichever of
 * `,` or `.` comes last with one or two digits after it is the decimal
 * separator, the other groups thousands. A range keeps its first price.
 */
function parsePrice(price: number | string | null | undefined): number | null {
  if (typeof price !== "string") {
    return typeof price === "number" && Number.isFinite(price) ? price : null;
  }
  const digits = PRICE_NUMBER.exec(price)?.[0].replace(PRICE_SPACES, "") ?? "";
  const decimal = DECIMAL_TAIL.exec(digits)?.[1];
  const normalized = decimal
    ? `${digits.slice(0, -decimal.length - 1).replace(SEPARATORS, "")}.${decimal}`
    : digits.replace(SEPARATORS, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Keeps what trend charts need from the commercial modules: who advertised,
 * which products showed and where, not the ad copy or images.
 */
export function geoOlostepSurfaces(
  payload: GeoOlostepAnswerPayload
): GeoCheckSurfaces {
  const search = payload.network_search_calls;
  return {
    provider: "olostep",
    model: search?.model_slug ?? payload.model ?? null,
    webSearched: payload.web_searched ?? search?.search_triggered ?? null,
    ads:
      payload.ads?.slice(0, GEO_CHECK_SURFACE_MAX_ADS).map((ad) => ({
        brand: ad.brand?.name?.trim() || null,
        domain:
          getReferenceDomain(ad.brand?.url) ??
          getReferenceDomain(ad.cards?.find((card) => card.url)?.url),
        cards: ad.cards?.length ?? 0,
      })) ?? null,
    products:
      payload.products
        ?.flatMap((product) => {
          const title = product.title?.trim();
          if (!title) {
            return [];
          }
          return [
            {
              title,
              price: parsePrice(product.price),
              currency: product.currency ?? null,
              vendors: (product.vendors ?? [])
                .flatMap((vendor) => {
                  const name =
                    vendor.website?.trim() || getReferenceDomain(vendor.link);
                  return name ? [name] : [];
                })
                .slice(0, GEO_CHECK_SURFACE_MAX_VENDORS),
            },
          ];
        })
        .slice(0, GEO_CHECK_SURFACE_MAX_PRODUCTS) ?? null,
    shoppingCards: payload.shopping_cards?.length ?? null,
    relatedQueries: (payload.related_queries ?? []).slice(
      0,
      GEO_CHECK_SURFACE_MAX_RELATED_QUERIES
    ),
  };
}

/**
 * Inline references are what the answer cites. The sources drawer only counts
 * as cited when the parser does not mark an entry `cited: false` (ChatGPT
 * lists searched but uncited pages there). Grounding keeps the same cited
 * list: every reader of `grounding.sources` shows it as the answer's sources,
 * so uncited search candidates would read as citations. The search queries
 * remain as the search evidence. Google AI Mode marks every panel source
 * `cited: false` and has no inline references; for such engines
 * (`panelSourcesCited`) the panel is what the answer cites.
 *
 * Google showing no AI Overview is a miss to store, not an engine failure.
 */
export function geoOlostepAnswer(
  payload: GeoOlostepAnswerPayload,
  { panelSourcesCited = false }: { panelSourcesCited?: boolean } = {}
): GeoEngineAnswer {
  const inline = payload.inline_references ?? [];
  const drawer = payload.sources ?? [];
  const cited = uniqueSources([
    ...inline,
    ...drawer.filter((source) => panelSourcesCited || source.cited !== false),
  ]);
  const queries = [
    ...new Set(
      [
        ...(payload.network_search_calls?.search_queries ?? []),
        ...(payload.search_model_queries ?? []),
      ].map(({ query }) => query)
    ),
  ].slice(0, GEO_CHECK_GROUNDING_MAX_QUERIES);
  const text = payload.answer_markdown?.trim() ?? "";
  return {
    text,
    grounding: { queries, sources: cited },
    sources: cited.map(({ title, url }) => ({ title, url })),
    finishReason: text ? "stop" : null,
    zdrEnforced: false,
    absent: payload.message === GEO_OLOSTEP_NO_AI_OVERVIEW_MESSAGE,
    surfaces: geoOlostepSurfaces(payload),
  };
}
