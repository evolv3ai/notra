export interface FakePullRequest {
  id: string;
  node_id: string;
  number: number;
  html_url: string;
  url: string;
  title: string;
  body?: string;
  state: "open" | "closed";
  draft: boolean;
  merged_at: string | null;
  head: { ref: string; sha: string; repo: { full_name: string } };
  base: { ref: string };
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: string;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
}
export interface FakeGitHubState {
  comments: FakeGitHubComment[];
  commitDelayMs: number;
  commitMetadataError: boolean;
  beforeCommitMetadata: (sha: string) => Promise<void>;
  loseRenameResponse: boolean;
  /** Answers this many more rename calls, then drops every rename response. */
  loseRenameResponseAfter: number | null;
  hideClassicProtection: boolean;
  treeDelayMs: number;
  protectionRules: string[] | null;
  protectionError: boolean | number;
  /** Answers the rules endpoint like a private repo on GitHub Free. */
  rulesetsUnavailable: boolean;
  omitProtected: boolean;
  rejectedMergeMethods: string[];
  prErrorMessage: string;
  beforeTree: (ref: string) => Promise<void>;
  branches: Map<string, string>;
  commits: Map<string, Map<string, string>>;
  prs: FakePullRequest[];
  classicPR: boolean;
  rulesPR: boolean;
  otherProtection: boolean;
  protectedFeatures: boolean;
  rejectDraft: boolean;
  failPR: boolean;
  staleCommit: boolean;
  commitCount: number;
  calls: string[];
  mergeMethod: string | null;
  beforeRead: (path: string) => Promise<void>;
  beforeCommit: () => Promise<void>;
}

export interface FakeGitHubComment {
  id: number;
  issueNumber: number;
  body: string;
  user: { type: string };
  performed_via_github_app: { id: number };
}

export interface FakeGitHubCommitMetadata {
  message: string;
  parentSha: string;
}
