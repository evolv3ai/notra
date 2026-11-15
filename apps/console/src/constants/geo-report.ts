import type {
  GeoChannel,
  GeoClaimStatus,
  GeoModel,
  GeoPromptIntent,
  GeoReportSection,
  GeoReportSectionId,
  GeoReportSectionState,
  GeoReportStatus,
  GeoSentiment,
} from "@/types/geo-report";

/** Models (not providers) an answer is sampled from. `gatewayModelId` is the Vercel AI Gateway id used by the scan. */
export const GEO_MODELS: GeoModel[] = [
  {
    id: "gpt-5-6-sol",
    gatewayModelId: "openai/gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    provider: "OpenAI",
    providerDomain: "openai.com",
    surface: "ChatGPT",
  },
  {
    id: "claude-opus-5",
    gatewayModelId: "anthropic/claude-opus-5",
    name: "Claude Opus 5",
    provider: "Anthropic",
    providerDomain: "anthropic.com",
    surface: "Claude",
  },
  {
    id: "gemini-3-7-flash",
    gatewayModelId: "google/gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    provider: "Google",
    providerDomain: "google.com",
    surface: "Gemini + AI Overviews",
  },
  {
    id: "grok-4-6",
    gatewayModelId: "spacexai/grok-4.6",
    name: "Grok 4.6",
    provider: "xAI",
    providerDomain: "x.ai",
    surface: "Grok on X",
  },
  {
    id: "kimi-k3",
    gatewayModelId: "moonshotai/kimi-k3",
    name: "Kimi K3",
    provider: "Moonshot AI",
    providerDomain: "moonshot.ai",
    surface: "Kimi",
  },
  {
    id: "glm-5-3",
    gatewayModelId: "zai/glm-5.3",
    name: "GLM-5.3",
    provider: "Z.ai",
    providerDomain: "z.ai",
    surface: "Z.ai chat",
  },
  {
    id: "deepseek-v4-pro",
    gatewayModelId: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4-Pro",
    provider: "DeepSeek",
    providerDomain: "deepseek.com",
    surface: "DeepSeek Chat",
  },
];

export const GEO_REPORT_SECTIONS: GeoReportSection[] = [
  {
    id: "cover",
    label: "Cover",
    description: "Logo, title and the headline finding.",
  },
  {
    id: "summary",
    label: "Summary",
    description: "Visibility, share of voice, sentiment, citations.",
  },
  {
    id: "prompts",
    label: "Prompts & performance",
    description: "Every tracked prompt, and where they rank in each model.",
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Share of voice and what each competitor wins on.",
  },
  {
    id: "perceptions",
    label: "What models say",
    description: "Each model's verdict and the claims that need fixing.",
  },
  {
    id: "shelf-space",
    label: "Shelf space",
    description: "Prompts where competitors are listed and they are not.",
  },
  {
    id: "sources",
    label: "Cited sources",
    description: "Where the models get their answers.",
  },
  {
    id: "plan",
    label: "How Notra helps",
    description: "The pitch, with the number of gaps to close.",
  },
];

export const GEO_DEFAULT_SECTION_STATE: GeoReportSectionState = {
  cover: true,
  summary: true,
  prompts: true,
  competitors: true,
  perceptions: true,
  "shelf-space": true,
  sources: true,
  plan: true,
};

export const GEO_SECTION_ORDER: GeoReportSectionId[] = GEO_REPORT_SECTIONS.map(
  (section) => section.id
);

export const GEO_INTENT_LABELS: Record<GeoPromptIntent, string> = {
  "best-of": "Best of",
  comparison: "Comparison",
  alternatives: "Alternatives",
  "how-to": "How to",
  pricing: "Pricing",
  branded: "Branded",
};

export const GEO_SENTIMENT_LABELS: Record<GeoSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  mixed: "Mixed",
  negative: "Negative",
};

export const GEO_CLAIM_STATUS_LABELS: Record<GeoClaimStatus, string> = {
  accurate: "Accurate",
  outdated: "Outdated",
  missing: "Missing",
  wrong: "Wrong",
};

export const GEO_CHANNEL_LABELS: Record<GeoChannel, string> = {
  docs: "Docs page",
  "comparison-page": "Comparison page",
  listicle: "Listicle placement",
  reddit: "Reddit thread",
  github: "GitHub README",
  youtube: "YouTube walkthrough",
  changelog: "Changelog post",
};

export const GEO_STATUS_LABELS: Record<GeoReportStatus, string> = {
  draft: "Draft",
  ready: "Ready to send",
  sent: "Sent",
};

export const GEO_LOGO_LINK_BASE_URL = "https://logos.context.dev/";

export const GEO_FAVICON_SIZE = 128;

export const GEO_VISIBILITY_SCORE_MAX = 100;

export const GEO_SENTIMENT_SCORE_MAX = 5;

/** Public report links live here; the route is forced to the light theme. */
export const SHARE_ROUTE_PREFIX = "/r/";

/** Placeholder id for a report that has not been saved yet; the server assigns the real one. */
export const GEO_NEW_REPORT_ID = "new";

export const GEO_SHARE_TOKEN_LENGTH = 24;

export const GEO_AUTOSAVE_DEBOUNCE_MS = 800;

export const CONTEXT_COMPETITORS_URL =
  "https://api.context.dev/v1/web/competitors";

export const CONTEXT_COMPETITORS_COUNT = 8;

/** Model used to read answers and extract ranks, sentiment and claims. */
export const GEO_SCAN_JUDGE_MODEL_ID = "openai/gpt-5.4-mini";

export const GEO_SCAN_MAX_STEPS = 4;

export const GEO_SCAN_MAX_CLAIMS = 4;

export const GEO_SCAN_MAX_SOURCES = 12;

/** Most-cited domains kept in the report; keeps the Sources chart readable and the row within limits. */
export const GEO_REPORT_MAX_SOURCES = 12;

export const GEO_SITE_TEXT_MAX = 12_000;

export const GEO_PROMPT_COUNT = 12;
