import { memorySearchKeywords } from "@notra/memory/utils/search";
import { and, inArray, type SQL, sql } from "drizzle-orm";

import {
  BRAND_REFERENCE_LIKE_SPECIAL,
  BRAND_REFERENCE_SEARCH_DEFAULT_LIMIT,
} from "../constants/brand-reference-search";
import { db } from "../drizzle";
import { brandReferences } from "../schema";

function escapeLikePattern(value: string) {
  return value.replace(BRAND_REFERENCE_LIKE_SPECIAL, "\\$&");
}

/**
 * Ranks the given references by how many query keywords their content or note
 * mention (case-insensitive) and returns their ids, best first; ties keep the
 * order of `referenceIds`. Empty when nothing matches, so callers fall back to
 * recent references.
 */
export async function searchBrandReferences(input: {
  query: string;
  referenceIds: readonly string[];
  limit?: number;
}) {
  const keywords = memorySearchKeywords(input.query);
  if (keywords.length === 0 || input.referenceIds.length === 0) {
    return [];
  }

  const keywordHits: SQL[] = keywords.map((keyword) => {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    return sql`(${brandReferences.content} ILIKE ${pattern} OR coalesce(${brandReferences.note}, '') ILIKE ${pattern})::int`;
  });
  const score = sql<number>`(${sql.join(keywordHits, sql` + `)})`;

  const rows = await db
    .select({ id: brandReferences.id, score })
    .from(brandReferences)
    .where(
      and(
        inArray(brandReferences.id, [...input.referenceIds]),
        sql`${score} > 0`
      )
    );

  const order = new Map(input.referenceIds.map((id, index) => [id, index]));
  return rows
    .sort(
      (left, right) =>
        Number(right.score) - Number(left.score) ||
        (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
    )
    .slice(0, input.limit ?? BRAND_REFERENCE_SEARCH_DEFAULT_LIMIT)
    .map((row) => row.id);
}
