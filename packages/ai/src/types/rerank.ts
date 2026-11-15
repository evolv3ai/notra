export interface RerankedDocument {
  /** Position in the documents passed in. */
  index: number;
  /** Relevance from 0 to 1. */
  score: number;
}
