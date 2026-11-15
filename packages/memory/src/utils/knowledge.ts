import {
  KNOWLEDGE_FALLBACK_SLUG,
  KNOWLEDGE_MEMORY_PREFIX,
  KNOWLEDGE_RECORD_PREFIX,
  KNOWLEDGE_SLUG_EDGE_DASHES,
  KNOWLEDGE_SLUG_MAX_LENGTH,
  KNOWLEDGE_SLUG_SEPARATORS,
  KNOWLEDGE_SLUG_TRAILING_DASHES,
} from "../constants/knowledge";
import { MEMORY_PATHS } from "../constants/memory";
import type { KnowledgeFact } from "../types/knowledge";
import type { MemorySnapshot } from "../types/memory";
import { parseRecords } from "./records";
import { memorySearchKeywords } from "./search";

/** One file per topic, so related facts are read together. */
export function knowledgePath(topic: string) {
  const slug = topic
    .toLowerCase()
    .normalize("NFKD")
    .replace(KNOWLEDGE_SLUG_SEPARATORS, "-")
    .replace(KNOWLEDGE_SLUG_EDGE_DASHES, "")
    .slice(0, KNOWLEDGE_SLUG_MAX_LENGTH)
    .replace(KNOWLEDGE_SLUG_TRAILING_DASHES, "");
  return MEMORY_PATHS.knowledge(slug || KNOWLEDGE_FALLBACK_SLUG);
}

export function parseKnowledgeFacts(
  path: string,
  markdown: string | null
): KnowledgeFact[] {
  return parseRecords(markdown, KNOWLEDGE_RECORD_PREFIX).map((record) => ({
    id: record.id,
    path,
    topic: record.title,
    content: record.body,
  }));
}

export async function readKnowledgeFacts(snapshot: MemorySnapshot) {
  const paths = (await snapshot.list()).filter((path) =>
    path.startsWith(KNOWLEDGE_MEMORY_PREFIX)
  );
  const files = await Promise.all(
    paths.map(async (path) =>
      parseKnowledgeFacts(path, await snapshot.read(path))
    )
  );
  return files.flat();
}

/** Number of query keywords a fact mentions. */
export function scoreKnowledgeFact(fact: KnowledgeFact, query: string) {
  const text = `${fact.topic}\n${fact.content}`.toLowerCase();
  return memorySearchKeywords(query).filter((keyword) => text.includes(keyword))
    .length;
}
