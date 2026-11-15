import type { FileDiffMetadata } from "@pierre/diffs";

import type { SiteDraftChange } from "@/types/site-drafts";

export type SiteFileDiffProps = {
  className?: string;
} & (
  | { fileDiff: FileDiffMetadata }
  | { path: string; before: string | null; after: string | null }
);

export interface SitePublishChangeProps {
  branch?: string;
  organizationId: string;
  siteId: string;
  path: string;
  change: SiteDraftChange;
  defaultOpen: boolean;
}
