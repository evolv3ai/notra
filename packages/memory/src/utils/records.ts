import { createHash } from "node:crypto";

import {
  MEMORY_RECORD_META_LINE,
  MEMORY_RECORD_SECTION,
} from "../constants/memory";
import type { MemoryRecord, MemoryRecordMeta } from "../types/records";

export function recordId(prefix: string, text: string) {
  return `${prefix}-${createHash("sha256").update(text.trim().toLowerCase()).digest("hex").slice(0, 16)}`;
}

function parseMeta(line: string): MemoryRecordMeta | null {
  const match = MEMORY_RECORD_META_LINE.exec(line.trim());
  if (!match?.[1]) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(match[1]);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as MemoryRecordMeta)
      : null;
  } catch {
    return null;
  }
}

/**
 * Reads `##` sections. People may edit the file by hand, so a section that
 * lost its metadata comment still counts, with an id derived from its title.
 */
export function parseRecords(
  markdown: string | null,
  idPrefix: string
): MemoryRecord[] {
  if (!markdown) {
    return [];
  }
  const records: MemoryRecord[] = [];
  let current: { title: string; lines: string[] } | null = null;
  const flush = () => {
    if (!current) {
      return;
    }
    const metaIndex = current.lines.findIndex((line) => parseMeta(line));
    const meta =
      metaIndex === -1 ? {} : (parseMeta(current.lines[metaIndex] ?? "") ?? {});
    const body = current.lines
      .filter((_, index) => index !== metaIndex)
      .join("\n")
      .trim();
    const id =
      typeof meta.id === "string" && meta.id
        ? meta.id
        : recordId(idPrefix, current.title);
    records.push({ id, title: current.title.trim(), body, meta });
  };
  for (const line of markdown.split("\n")) {
    const section = MEMORY_RECORD_SECTION.exec(line);
    if (section?.[1]) {
      flush();
      current = { title: section[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return records;
}

export function renderRecords(params: {
  title: string;
  intro: string;
  records: readonly MemoryRecord[];
}) {
  const sections = params.records.map((record) => {
    const meta = JSON.stringify({ ...record.meta, id: record.id });
    // A heading inside a body would split the record when read back.
    const body = record.body.replace(/^#{1,6} /gm, "");
    return [
      `## ${record.title.replace(/\s+/g, " ").trim()}`,
      `<!-- notra ${meta} -->`,
      body,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return `${[`# ${params.title}`, params.intro, ...sections].join("\n\n").trim()}\n`;
}
