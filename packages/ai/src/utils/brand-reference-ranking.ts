import { rerankDocuments } from "@notra/ai/utils/rerank";
import { searchBrandReferences } from "@notra/db/utils/brand-reference-search";

/**
 * The references that fit the query best: reranked by meaning, by keyword
 * when the reranker is unavailable, and the most recent when nothing matches.
 * `references` arrive newest first.
 */
export async function rankBrandReferences<
  REFERENCE extends { id: string; content: string; note: string | null },
>(params: {
  query: string;
  references: readonly REFERENCE[];
  limit: number;
  organizationId: string;
}): Promise<{ references: REFERENCE[]; source: "search" | "fallback" }> {
  const { references, limit } = params;
  const reranked = await rerankDocuments({
    query: params.query,
    documents: references.map((reference) =>
      reference.note
        ? `${reference.note}\n${reference.content}`
        : reference.content
    ),
    topN: limit,
    feature: "brand-references",
    organizationId: params.organizationId,
  });
  if (reranked?.length) {
    return {
      references: reranked.flatMap(({ index }) => references[index] ?? []),
      source: "search",
    };
  }
  try {
    const byId = new Map(
      references.map((reference) => [reference.id, reference])
    );
    const matched = (
      await searchBrandReferences({
        query: params.query,
        referenceIds: references.map((reference) => reference.id),
        limit,
      })
    ).flatMap((id) => byId.get(id) ?? []);
    if (matched.length > 0) {
      return { references: matched, source: "search" };
    }
  } catch {
    // Recent references below.
  }
  return { references: references.slice(0, limit), source: "fallback" };
}
