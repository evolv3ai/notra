export interface CompanyKnowledgeConfig {
  organizationId: string;
}

/** What chat and the content writer see: the fact, not where it is stored. */
export interface CompanyKnowledgeAnswer {
  facts: Array<{ topic: string; content: string }>;
}
