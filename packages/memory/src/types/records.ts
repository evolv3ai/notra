export type MemoryRecordMeta = Record<string, string | number | boolean | null>;

/** One `##` section of a memory file: a rule, a feedback note, a fact. */
export interface MemoryRecord {
  id: string;
  title: string;
  body: string;
  meta: MemoryRecordMeta;
}
