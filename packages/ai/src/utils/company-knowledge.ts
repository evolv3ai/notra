import { RERANK_MAX_DOCUMENTS } from "@notra/ai/constants/rerank";
import type { CompanyKnowledgeAnswer } from "@notra/ai/types/company-knowledge";
import { rerankDocuments } from "@notra/ai/utils/rerank";
import { openMemorySnapshot } from "@notra/memory/memory";
import type {
  KnowledgeFact,
  RankedKnowledgeFact,
} from "@notra/memory/types/knowledge";
import { MemoryNotConfiguredError } from "@notra/memory/utils/errors";
import {
  readKnowledgeFacts,
  scoreKnowledgeFact,
} from "@notra/memory/utils/knowledge";

/**
 * All facts while they fit the reranker; past that, keyword hits go first so a
 * fact the query names is never cut off by where its file sorts.
 */
function rerankCandidates(facts: KnowledgeFact[], query: string) {
  if (facts.length <= RERANK_MAX_DOCUMENTS) {
    return facts;
  }
  return facts
    .map((fact, order) => ({
      fact,
      order,
      score: scoreKnowledgeFact(fact, query),
    }))
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, RERANK_MAX_DOCUMENTS)
    .map(({ fact }) => fact);
}

/**
 * The organization's knowledge facts that fit the query best: reranked by
 * meaning, or by keyword when the reranker is unavailable.
 */
export async function searchCompanyKnowledge(params: {
  organizationId: string;
  query: string;
  limit: number;
}): Promise<RankedKnowledgeFact[]> {
  const { organizationId, query, limit } = params;
  const facts = await readKnowledgeFacts(
    await openMemorySnapshot(organizationId)
  );
  if (facts.length === 0) {
    return [];
  }

  const candidates = rerankCandidates(facts, query);
  const reranked = await rerankDocuments({
    query,
    documents: candidates.map((fact) => `${fact.topic}: ${fact.content}`),
    topN: limit,
    feature: "knowledge",
    organizationId,
  });
  if (reranked) {
    return reranked.flatMap(({ index, score }) =>
      candidates[index] ? [{ fact: candidates[index], score }] : []
    );
  }
  return facts
    .map((fact) => ({ fact, score: scoreKnowledgeFact(fact, query) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

/** The chat and content-writer tool result; no memory configured means nothing known. */
export async function answerFromCompanyKnowledge(params: {
  organizationId: string;
  query: string;
  limit: number;
}): Promise<CompanyKnowledgeAnswer> {
  try {
    const ranked = await searchCompanyKnowledge(params);
    return {
      facts: ranked.map(({ fact }) => ({
        topic: fact.topic,
        content: fact.content,
      })),
    };
  } catch (error) {
    if (error instanceof MemoryNotConfiguredError) {
      return { facts: [] };
    }
    throw error;
  }
}
