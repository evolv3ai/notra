export interface EmulatedFileChange {
  path: string;
  /** Null deletes the file. */
  content: Uint8Array | null;
}

export interface GitHubEmulatorOptions {
  directory: string;
  owner: string;
  repo: string;
  appId: number;
  installationId: number;
  webhookUrl: string;
  webhookSecret: string;
  files: Map<string, Uint8Array>;
  branchRules?: { type: string }[];
}

export interface CommitOnBranchInput {
  branch: { repositoryNameWithOwner: string; branchName: string };
  message: { headline: string };
  expectedHeadOid: string;
  fileChanges: {
    additions?: { path: string; contents: string }[];
    deletions?: { path: string }[];
  };
}

export type GraphQLVariables = Record<string, unknown> & {
  id?: string;
  input?: unknown;
};

/** The fields of emulate's REST pull request the proxy reads. */
export interface EmulatedPull {
  number: number;
  node_id: string;
  html_url: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  commits?: number;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
}
