import { searchCompanyKnowledgeInputSchema } from "@notra/ai/schemas/company-knowledge";
import { answerFromCompanyKnowledge } from "@notra/ai/utils/company-knowledge";
import { defineTool } from "eve/tools";

import { requireOrganizationId } from "../utils/organization";

export function createSearchCompanyKnowledgeTool() {
  return defineTool({
    description:
      "Searches what onboarding research learned about the organization: positioning, audience, tone evidence, covered topics, competitors. Facts are ranked by meaning, so ask a short question; the closest facts come back even when nothing on the subject is known, so use only facts that answer it. Use it for company context, not for writing samples (search_brand_references) or product changes (GitHub tools).",
    inputSchema: searchCompanyKnowledgeInputSchema,
    execute: ({ query, limit }, ctx) =>
      answerFromCompanyKnowledge({
        organizationId: requireOrganizationId(ctx),
        query,
        limit,
      }),
  });
}
