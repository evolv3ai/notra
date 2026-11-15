import type { ReportEngine } from "../shared";

export const OLOSTEP_REPORT_ENGINES: Partial<Record<ReportEngine, string>> = {
  chatgpt: "openai/chatgpt",
  perplexity: "perplexity/perplexity",
};

export const CONTEXT_REPORT_ENGINES: Partial<Record<ReportEngine, string>> = {
  gemini: "google/gemini",
  "ai-overview": "google/ai-overview",
};

export const REPORT_CAPTURE_METHOD = "olostep-context-v1";
export const OLOSTEP_REPORT_WAIT_MS = 10 * 60 * 1000;
export const OLOSTEP_REPORT_POLL_MS = 10_000;
