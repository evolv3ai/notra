/**
 * Orders memory and brand references by meaning, so a paraphrased query still
 * finds the right entry. The only reranker the AI Gateway serves with zero
 * data retention; on the recall benchmark it found 96-100% of the expected
 * entries where keyword search found 67-75%.
 */
export const RERANK_MODEL_ID = "cohere/rerank-v3.5";
export const RERANK_TIMEOUT_MS = 5000;
/** The model's per-call document limit. */
export const RERANK_MAX_DOCUMENTS = 1000;
