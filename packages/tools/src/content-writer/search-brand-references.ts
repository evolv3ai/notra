import { rankBrandReferences } from "@notra/ai/utils/brand-reference-ranking";
import { defineTool } from "eve/tools";

import { searchBrandReferencesInputSchema } from "../schemas/assistant-tools";
import {
  getFilteredBrandReferences,
  toWriterBrandReference,
} from "../utils/brand-references";
import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

export function createSearchBrandReferencesTool() {
  return defineTool({
    description:
      "Searches brand voice references by meaning and returns the most relevant writing samples for the current content task. Describe the angle, topic or voice signal you need in a short phrase.",
    inputSchema: searchBrandReferencesInputSchema,
    async execute({ query, limit }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const agentType = getSessionAttribute(ctx, "brandAgentType") ?? undefined;
      const { settingsId, references } = await getFilteredBrandReferences({
        organizationId,
        voiceId: getSessionAttribute(ctx, "voiceId") ?? undefined,
        agentType,
      });

      if (!settingsId || references.length === 0) {
        return { references: [], count: 0, source: "empty" };
      }

      const ranked = await rankBrandReferences({
        query,
        references,
        limit,
        organizationId,
      });
      return {
        references: ranked.references.map(toWriterBrandReference),
        count: ranked.references.length,
        source: ranked.source,
      };
    },
  });
}
