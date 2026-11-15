export interface KnowledgeFact {
  id: string;
  path: string;
  topic: string;
  content: string;
}

export interface RankedKnowledgeFact {
  fact: KnowledgeFact;
  score: number;
}
