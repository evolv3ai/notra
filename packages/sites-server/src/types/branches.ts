export interface BranchPullRequest {
  id: string;
  number: number;
  url: string;
  isDraft: boolean;
  state: "OPEN" | "CLOSED" | "MERGED";
  merged: boolean;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: string;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  headRefOid: string;
  commits?: { totalCount: number };
}

export interface BranchPullRequestResponse {
  node: BranchPullRequest | null;
}

export interface CreateSiteBranchInput {
  branch?: string;
  title: string;
  bringChanges: boolean;
  userId: string;
}

export interface BranchProtectionCacheEntry {
  allowed: boolean;
  expires: number;
}

export interface BranchProtectionResponse {
  repository: {
    ref: { branchProtectionRule: { id: string } | null } | null;
  } | null;
}
