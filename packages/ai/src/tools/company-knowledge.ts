import { searchCompanyKnowledgeInputSchema } from "@notra/ai/schemas/company-knowledge";
import type { CompanyKnowledgeConfig } from "@notra/ai/types/company-knowledge";
import { answerFromCompanyKnowledge } from "@notra/ai/utils/company-knowledge";
import { toolDescription } from "@notra/ai/utils/description";
import { type Tool, tool } from "ai";

export function createSearchCompanyKnowledgeTool(
  config: CompanyKnowledgeConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "searchCompanyKnowledge",
      intro:
        "Searches what onboarding research learned about the organization: positioning, audience, tone evidence, covered topics and competitors.",
      whenToUse:
        "Use when you need company context the brand identity does not cover, such as competitors, topics already written about, or how the company positions itself.",
      whenNotToUse:
        "Do not use this for writing samples (searchBrandReferences) or for product changes (GitHub tools).",
      usageNotes:
        "Facts are ranked by meaning, so ask a short question. The closest facts come back even when nothing was learned on the subject, so use only facts that answer the question.",
    }),
    inputSchema: searchCompanyKnowledgeInputSchema,
    execute: ({ query, limit }) =>
      answerFromCompanyKnowledge({
        organizationId: config.organizationId,
        query,
        limit,
      }),
  });
}
