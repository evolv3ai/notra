import type { SiteRepository } from "@notra/sites-server/types/github";

export interface ContentReviewProcessInput {
  reviewProcess: "pull_request" | "direct";
  token: string;
  repository: SiteRepository;
  branch: string;
  siteId?: string;
  rootDirectory?: string;
  targetBranch?: string;
  path: string;
}
