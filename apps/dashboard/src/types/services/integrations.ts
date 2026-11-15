import type { GitHubConnectionMethod } from "@notra/ai/types/github-connection";
import type { IntegrationType } from "@notra/schemas/dashboard/integrations";

import type { RepositoryOutput } from "@/types/integrations";

export interface WebhookConfig {
  webhookUrl: string;
  webhookSecret: string;
  repositoryId: string;
  owner: string;
  repo: string;
}

interface IntegrationWithRepositories {
  id: string;
  displayName: string;
  type: IntegrationType;
  connectionMethod?: GitHubConnectionMethod;
  enabled: boolean;
  createdAt: Date;
  managedByGitHubApp?: boolean;
  repositories: Array<{
    id: string;
    owner: string;
    repo: string;
    defaultBranch: string | null;
    enabled: boolean;
    hasWebhook?: boolean;
    outputs?: RepositoryOutput[];
  }>;
}

export interface IntegrationsResponse {
  integrations: IntegrationWithRepositories[];
  count: number;
}

export type IntegrationFetcher = (
  organizationId: string
) => Promise<IntegrationWithRepositories[]>;
