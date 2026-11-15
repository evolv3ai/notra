import {
  array,
  boolean,
  looseObject,
  number,
  object,
  string,
  union,
  unknown,
} from "zod";
import type { ZodType } from "zod";

const geoOlostepSourceSchema = object({
  url: string(),
  title: string().nullish(),
  label: string().nullish(),
  text: string().nullish(),
  cited: boolean().nullish(),
});

const geoOlostepQuerySchema = object({ query: string() });

const geoOlostepAdSchema = looseObject({
  brand: looseObject({
    name: string().nullish(),
    url: string().nullish(),
  }).nullish(),
  cards: array(looseObject({ url: string().nullish() })).nullish(),
});

const geoOlostepProductSchema = looseObject({
  title: string().nullish(),
  price: union([number(), string()]).nullish(),
  currency: string().nullish(),
  vendors: array(
    looseObject({ website: string().nullish(), link: string().nullish() })
  ).nullish(),
});

/**
 * A module's items, keeping the well-formed ones when one is malformed. A
 * module with items but none readable is unknown (null), not "none shown".
 */
function moduleItems<T extends ZodType>(item: T) {
  return array(item.nullable().catch(null))
    .transform((items) => {
      const readable = items.filter((entry) => entry !== null);
      return items.length > 0 && readable.length === 0 ? null : readable;
    })
    .nullish()
    .catch(null);
}

/**
 * Fields shared by Olostep's GEO parsers (ChatGPT, Perplexity, Gemini,
 * Copilot, Google AI Mode and AI Overview), plus the commercial modules some
 * of them render. Those modules fall back to null on an unexpected shape, so
 * a parser change never costs the answer itself.
 */
export const geoOlostepAnswerSchema = object({
  answer_markdown: string().nullish(),
  inline_references: array(geoOlostepSourceSchema).nullish(),
  sources: array(geoOlostepSourceSchema).nullish(),
  search_model_queries: array(geoOlostepQuerySchema).nullish(),
  network_search_calls: object({
    search_queries: array(geoOlostepQuerySchema).nullish(),
    search_triggered: boolean().nullish().catch(null),
    model_slug: string().nullish().catch(null),
  }).nullish(),
  message: string().nullish(),
  ads: moduleItems(geoOlostepAdSchema),
  products: moduleItems(geoOlostepProductSchema),
  shopping_cards: array(unknown()).nullish().catch(null),
  related_queries: array(string()).nullish().catch(null),
  model: string().nullish().catch(null),
  web_searched: boolean().nullish().catch(null),
});

export const geoOlostepBatchSchema = object({
  id: string(),
  status: string(),
});

export const geoOlostepBatchItemsSchema = object({
  items: array(object({ custom_id: string(), retrieve_id: string() })),
  cursor: union([number(), string()]).nullish(),
});

export const geoOlostepRetrieveSchema = object({
  json_content: string().nullish(),
});
