import { sanitizeMarkdownHtml } from "@notra/ai/utils/sanitize";
import type { posts } from "@notra/db/schema";
import { postMetadataUpdateData } from "@notra/db/utils/post-metadata";
import type {
  ContentHistoryChange,
  ContentHistoryEntry,
  ContentHistoryVersion,
} from "@notra/schemas/types/dashboard/content-history";
import { marked } from "marked";

import { CONTENT_HISTORY_METADATA_CHANGES } from "@/constants/content-history";
import type {
  ContentHistoryListRow,
  ContentHistoryRow,
} from "@/types/content/history-server";

export function serializeContentHistoryEntry(
  row: ContentHistoryRow
): ContentHistoryEntry {
  return {
    id: row.id,
    revision: row.revision,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    source: row.source,
    retained: row.retained,
    actor:
      row.actorUserId && row.actorName
        ? { id: row.actorUserId, name: row.actorName }
        : null,
  };
}

export async function contentHistoryRestoreData(
  version: Pick<ContentHistoryVersion, "title" | "slug" | "metadata"> & {
    markdown: string;
  }
): Promise<Partial<typeof posts.$inferInsert>> {
  return {
    title: version.title,
    slug: version.slug,
    markdown: version.markdown,
    content: sanitizeMarkdownHtml(await marked.parse(version.markdown)),
    recommendations: version.metadata.recommendations,
    contentSubtype: version.metadata.contentSubtype,
    ...postMetadataUpdateData({
      ...version.metadata,
      displayDate: version.metadata.displayDate?.slice(0, 10) ?? null,
    }),
    updatedAt: new Date(),
  };
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/** Lists what changed in `row` compared with the version saved before it. */
export function contentHistoryChanges(
  row: ContentHistoryListRow,
  previous: ContentHistoryListRow | undefined
): ContentHistoryChange[] {
  if (!previous) {
    return [];
  }
  const changes = new Set<ContentHistoryChange>();
  if (row.markdownHash !== previous.markdownHash) {
    changes.add("text");
  }
  if (row.title !== previous.title) {
    changes.add("title");
  }
  if (row.slug !== previous.slug) {
    changes.add("slug");
  }
  const current = metadataRecord(row.metadata);
  const before = metadataRecord(previous.metadata);
  for (const key of new Set([
    ...Object.keys(current),
    ...Object.keys(before),
  ])) {
    if (JSON.stringify(current[key]) !== JSON.stringify(before[key])) {
      changes.add(CONTENT_HISTORY_METADATA_CHANGES[key] ?? "settings");
    }
  }
  return [...changes];
}
