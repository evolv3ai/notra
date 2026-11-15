import { searchCompanyKnowledge } from "@notra/ai/utils/company-knowledge";
import { defineTool } from "eve/tools";

import { searchMemoryInputSchema } from "../schemas/onboarding-tools";
import { requireOrganizationId } from "../utils/organization";
import { withTransientRetry } from "../utils/retry";

export function createSearchMemoryTool() {
  return defineTool({
    description:
      "Search the organization's knowledge memory for existing facts before saving new ones or making claims about what is already known. Facts are ranked by meaning, so a short question or phrase works.",
    inputSchema: searchMemoryInputSchema,
    async execute({ query, limit }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const ranked = await withTransientRetry(
        () => searchCompanyKnowledge({ organizationId, query, limit }),
        { operationName: "Knowledge memory search" }
      );

      return {
        results: ranked.map(({ fact, score }) => ({
          memoryId: fact.id,
          path: fact.path,
          topic: fact.topic,
          content: fact.content,
          score,
        })),
      };
    },
  });
}
