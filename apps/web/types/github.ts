export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  description: string | null;
  private: boolean;
}

export interface ContributorsData {
  contributors: GitHubUser[];
}

export interface OgContributor extends GitHubUser {
  displayLogin: string;
}
