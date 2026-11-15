import type { ReferenceSnapshotDescriptor } from "./reference-snapshot";

export type ScrapePageResult =
  | ({
      url: string;
      title: string | null;
      markdown: string;
    } & Partial<ReferenceSnapshotDescriptor>)
  | {
      url: string;
      title: null;
      markdown: null;
      error: string;
    };
