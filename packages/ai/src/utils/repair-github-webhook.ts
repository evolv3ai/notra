import { GitHubWebhookRepairPreconditionError } from "../schemas/github-operations";
import type { GitHubWebhookRecoveryParams } from "../types/github-webhook-recovery";

export async function repairGitHubWebhook({
  octokit,
  webhook,
  organizationId,
  integrationExists,
}: GitHubWebhookRecoveryParams) {
  const target = new URL(webhook.webhookUrl);
  const candidates: number[] = [];

  for (let page = 1; ; page++) {
    const { data: hooks } = await octokit.request(
      "GET /repos/{owner}/{repo}/hooks",
      { owner: webhook.owner, repo: webhook.repo, per_page: 100, page }
    );
    for (const hook of hooks) {
      if (!(hook.active && hook.name === "web" && hook.config.url)) {
        continue;
      }
      let url: URL;
      try {
        url = new URL(hook.config.url);
      } catch {
        continue;
      }
      const parts = url.pathname.split("/");
      if (
        url.origin !== target.origin ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        parts.length !== 7 ||
        parts[1] !== "api" ||
        parts[2] !== "webhooks" ||
        parts[3] !== "github" ||
        parts[4] !== organizationId ||
        !parts[5] ||
        parts[5] !== parts[6]
      ) {
        continue;
      }
      if (
        parts[5] !== webhook.repositoryId &&
        (await integrationExists(parts[5]))
      ) {
        continue;
      }
      candidates.push(hook.id);
    }
    if (hooks.length < 100) {
      break;
    }
  }

  if (candidates.length !== 1) {
    throw new GitHubWebhookRepairPreconditionError({
      message:
        "No unambiguous active Notra webhook found. Check the repository webhooks in GitHub.",
    });
  }

  const hookId = candidates[0];
  if (hookId === undefined) {
    throw new GitHubWebhookRepairPreconditionError({
      message: "Notra webhook not found",
    });
  }
  await octokit.request("PATCH /repos/{owner}/{repo}/hooks/{hook_id}", {
    owner: webhook.owner,
    repo: webhook.repo,
    hook_id: hookId,
    config: {
      url: webhook.webhookUrl,
      content_type: "json",
      secret: webhook.webhookSecret,
      insecure_ssl: "0",
    },
  });

  return { hookId };
}
