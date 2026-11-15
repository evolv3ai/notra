import { createGateway } from "@ai-sdk/gateway";
import {
  RERANK_MAX_DOCUMENTS,
  RERANK_MODEL_ID,
  RERANK_TIMEOUT_MS,
} from "@notra/ai/constants/rerank";
import { log } from "@notra/ai/evlog";
import type { RerankedDocument } from "@notra/ai/types/rerank";
import { rerank } from "ai";

let gateway: ReturnType<typeof createGateway> | undefined;

/**
 * The documents most relevant to the query, best first. Null when the gateway
 * is not configured or the call fails, so callers keep a keyword search.
 */
export async function rerankDocuments(params: {
  query: string;
  documents: readonly string[];
  topN: number;
  feature: string;
  organizationId?: string;
}): Promise<RerankedDocument[] | null> {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  // On Vercel the gateway also authenticates via OIDC without an explicit key.
  if (
    !(apiKey || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1")
  ) {
    return null;
  }
  if (params.documents.length === 0) {
    return [];
  }
  gateway ??= createGateway({ apiKey });
  const documents = params.documents.slice(0, RERANK_MAX_DOCUMENTS);
  try {
    const { ranking } = await rerank({
      model: gateway.rerankingModel(RERANK_MODEL_ID),
      query: params.query,
      documents,
      // Cohere rejects asking for more results than there are documents.
      topN: Math.min(params.topN, documents.length),
      abortSignal: AbortSignal.timeout(RERANK_TIMEOUT_MS),
      providerOptions: {
        gateway: {
          zeroDataRetention: true,
          disallowPromptTraining: true,
          tags: [`rerank-${params.feature}`],
          ...(params.organizationId ? { user: params.organizationId } : {}),
        },
      },
    });
    return ranking.map(({ originalIndex, score }) => ({
      index: originalIndex,
      score,
    }));
  } catch (error) {
    log.warn({
      event: "ai.rerank.failed",
      feature: params.feature,
      organizationId: params.organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
