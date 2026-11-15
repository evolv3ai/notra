export interface PostGitHubPublish {
  branchName: string;
  owner: string;
  path: string;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
  siteId?: string;
  baseBranch?: string;
  direct?: boolean;
  assetPaths?: string[];
  writtenBlobs?: Record<string, string>;
  headSha?: string;
  repo: string;
  repositoryId: string;
}
