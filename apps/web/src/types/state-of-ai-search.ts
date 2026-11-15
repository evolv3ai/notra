export type StateOfAiSearchEngineId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "ai-overview";

export interface StateOfAiSearchBrand {
  name: string;
  domain: string;
}

export interface StateOfAiSearchEngine {
  id: StateOfAiSearchEngineId;
  label: string;
  model: string;
  answers: number;
  brandsPerAnswer: number;
  sourcesPerAnswer: number;
}

export interface StateOfAiSearchRankingRow extends StateOfAiSearchBrand {
  rank: number;
  visibility: number;
  topPick: number;
  ownSiteCited: number;
  byEngine: Record<StateOfAiSearchEngineId, number | null>;
  delta: number | null;
}

export interface StateOfAiSearchPromptAnswer {
  engine: StateOfAiSearchEngineId;
  text: string;
  overview: StateOfAiSearchOverview | null;
  mentioned: string[];
  sources: { url: string; title: string | null; domain: string }[];
  searchQueries: string[];
  highlights: { brand: string; text: string; match: string }[];
  collectedAt: string;
}

export interface StateOfAiSearchPromptRow {
  id: number;
  prompt: string;
  topPick: StateOfAiSearchBrand | null;
  brands: StateOfAiSearchBrand[];
  answers: number;
  consensus: boolean;
  aiOverviewShown: boolean;
  mentions: Record<string, number>;
  firsts: Record<string, number>;
  responses: StateOfAiSearchPromptAnswer[];
}

export interface StateOfAiSearchSource {
  domain: string;
  share: number;
  byEngine: Record<StateOfAiSearchEngineId, number | null>;
  citations: number;
  pages: { url: string; title: string | null; citations: number }[];
  prompts: {
    id: number;
    citations: number;
    engines: StateOfAiSearchEngineId[];
  }[];
}

export type StateOfAiSearchOverviewBlock =
  | { type: "paragraph"; text: string; refs: number[] }
  | { type: "heading"; text: string }
  | { type: "list"; items: { text: string; refs: number[] }[] };

export interface StateOfAiSearchOverview {
  query: string;
  blocks: StateOfAiSearchOverviewBlock[];
  references: { index: number; title: string; url: string; source: string }[];
}

export interface StateOfAiSearchQuote {
  engine: StateOfAiSearchEngineId;
  prompt: string;
  text: string;
  collectedAt: string;
}

export interface StateOfAiSearchReport {
  slug: string;
  edition: string;
  editionLabel: string;
  publishedAt: string;
  subject: string;
  noun: string;
  engines: StateOfAiSearchEngine[];
  totals: {
    prompts: number;
    answers: number;
    brands: number;
    citedDomains: number;
    consensus: number;
    aiOverviewShown: number;
  };
  ranking: StateOfAiSearchRankingRow[];
  prompts: StateOfAiSearchPromptRow[];
  sources: StateOfAiSearchSource[];
  overview: StateOfAiSearchOverview | null;
  quotes: Record<string, StateOfAiSearchQuote[]>;
}

export interface StateOfAiSearchSummary extends Pick<
  StateOfAiSearchReport,
  | "slug"
  | "edition"
  | "editionLabel"
  | "publishedAt"
  | "subject"
  | "noun"
  | "engines"
> {
  leaders: StateOfAiSearchRankingRow[];
}
