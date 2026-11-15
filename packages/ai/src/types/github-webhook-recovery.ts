import type { Octokit } from "@octokit/core";

import type { WebhookConfig } from "./integrations";

export interface GitHubWebhookRecoveryParams {
  octokit: Octokit;
  webhook: WebhookConfig;
  organizationId: string;
  integrationExists: (integrationId: string) => Promise<boolean>;
}
