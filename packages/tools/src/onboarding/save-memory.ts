import {
  KNOWLEDGE_RECORD_PREFIX,
  KNOWLEDGE_SOURCE_TAG,
} from "@notra/memory/constants/knowledge";
import { updateMemory } from "@notra/memory/memory";
import { knowledgePath } from "@notra/memory/utils/knowledge";
import {
  parseRecords,
  recordId,
  renderRecords,
} from "@notra/memory/utils/records";
import { defineTool } from "eve/tools";

import { saveMemoryInputSchema } from "../schemas/onboarding-tools";
import { requireOrganizationId } from "../utils/organization";
import { withTransientRetry } from "../utils/retry";

export function createSaveMemoryTool() {
  return defineTool({
    description:
      "Save one curated, durable fact about the organization to its knowledge memory: positioning, tone evidence, audience, covered topics, or competitors. Facts are grouped into one file per topic. Never raw scrapes.",
    inputSchema: saveMemoryInputSchema,
    async execute({ content, topic }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const path = knowledgePath(topic);
      const fact = content.trim();
      const memoryId = recordId(KNOWLEDGE_RECORD_PREFIX, fact);
      let skipped = false;

      await withTransientRetry(
        () =>
          updateMemory({
            organizationId,
            actor: "knowledge",
            message: `Save knowledge about ${topic}`,
            mutate: async (snapshot) => {
              const records = parseRecords(
                await snapshot.read(path),
                KNOWLEDGE_RECORD_PREFIX
              );
              skipped = records.some((record) => record.id === memoryId);
              if (skipped) {
                return null;
              }
              return {
                [path]: renderRecords({
                  title: `Knowledge: ${topic}`,
                  intro:
                    "Curated facts about the organization. One fact per section.",
                  records: [
                    ...records,
                    {
                      id: memoryId,
                      title: topic,
                      body: fact,
                      meta: {
                        source: KNOWLEDGE_SOURCE_TAG,
                        savedAt: new Date().toISOString(),
                      },
                    },
                  ],
                }),
              };
            },
          }),
        { operationName: "Knowledge memory write" }
      );

      return { memoryId, path, skipped, topic };
    },
  });
}
