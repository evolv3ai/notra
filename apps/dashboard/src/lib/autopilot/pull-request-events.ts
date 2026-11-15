import {
  findGitHubIntegrationForMention,
  listOrganizationsForGitHubInstallation,
} from "@notra/ai/utils/github-mention-auth";
import { postGitHubIssueComment } from "@notra/ai/utils/github-pr-comments";
import { logInfo } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { autopilotSettings } from "@notra/db/schema";
import type { AutopilotCommitFilters } from "@notra/db/types/autopilot";
import { eq } from "drizzle-orm";

import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_FINDING_MAX_FAILURES,
  AUTOPILOT_PR_OFFER_CONFIDENCE,
} from "@/constants/autopilot";
import {
  assessPullRequestForPost,
  proposeCommitPost,
} from "@/lib/autopilot/blog";
import { commitFilterSkipReason } from "@/lib/autopilot/commit-filters";
import {
  dismissFinding,
  findFindingByFingerprint,
  rememberOfferComment,
} from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import {
  getInstallationOctokit,
  getRepositoryOctokit,
} from "@/lib/autopilot/github";
import {
  createAutopilotLogger,
  silentAutopilotLogger,
} from "@/lib/autopilot/log";
import {
  buildAutopilotRunContext,
  createItemAutopilotRun,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import {
  getContentPullRequestState,
  markContentPullRequestReady,
} from "@/lib/integrations/github/content-pull-request";
import { autopilotPullRequestEventSchema } from "@/schemas/autopilot-github";
import type {
  AutopilotJobResult,
  AutopilotPullRequestEvent,
  AutopilotRunContext,
  MergedPullRequest,
} from "@/types/autopilot";
import type { AutopilotLogger } from "@/types/autopilot-runtime";
import { toAutopilotCommitFilters } from "@/utils/autopilot-commit-filters";
import { formatAutopilotPercent as percent } from "@/utils/autopilot-events";
import {
  commitFingerprint,
  autopilotPullRequestMoment,
  isPostCandidateTitle,
  toMergedPullRequest,
} from "@/utils/autopilot-github";
import { toErrorMessage } from "@/utils/error-message";

/** Workspaces that want Autopilot to look at pull requests in this repository. */
async function listEligibleOrganizations(params: {
  installationId: string;
  repositoryId: string;
  owner: string;
  repo: string;
}) {
  const organizations = await listOrganizationsForGitHubInstallation(
    params.installationId
  );
  const eligible: {
    organizationId: string;
    commitFilters: AutopilotCommitFilters;
  }[] = [];
  for (const { organizationId } of organizations) {
    const [available, settings, integration] = await Promise.all([
      isAutopilotEnabledForOrganization(organizationId),
      db.query.autopilotSettings.findFirst({
        columns: { enabled: true, jobs: true, commitFilters: true },
        where: eq(autopilotSettings.organizationId, organizationId),
      }),
      // "@notra write a post" only works where mentions are connected.
      findGitHubIntegrationForMention({
        organizationId,
        githubRepositoryId: params.repositoryId,
        owner: params.owner,
        repo: params.repo,
      }),
    ]);
    const jobs = { ...AUTOPILOT_DEFAULT_JOBS, ...settings?.jobs };
    if (available && settings?.enabled && jobs.commits && integration) {
      eligible.push({
        organizationId,
        commitFilters: toAutopilotCommitFilters(settings.commitFilters),
      });
    }
  }
  return eligible;
}

/**
 * Autopilot on product pull requests. When a PR is ready for review, Jev
 * decides once whether the change is worth a post: 95%+ drafts it right away,
 * 85%+ asks in a comment, 60%+ waits silently on the dashboard. A PR merged
 * without that look gets it at merge. The draft follows the feature: closed
 * unmerged closes the draft, merged tells the draft it can ship.
 */
export async function handleAutopilotPullRequestEvent(rawBody: string) {
  const parsed = autopilotPullRequestEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return;
  }
  const event = parsed.data;
  const pr = event.pull_request;
  const moment = autopilotPullRequestMoment(event);
  if (!moment) {
    return;
  }
  const organizations = await listEligibleOrganizations({
    installationId: String(event.installation.id),
    repositoryId: String(event.repository.id),
    owner: event.repository.owner.login,
    repo: event.repository.name,
  });
  // One look per pull request even when several workspaces share the install.
  const eligible = organizations[0];
  if (!eligible) {
    return;
  }
  const { organizationId } = eligible;
  const pull = toMergedPullRequest(event.repository.full_name, {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    body: pr.body ?? null,
    author: pr.user?.login ?? null,
  });
  const existing = await findFindingByFingerprint(
    organizationId,
    commitFingerprint(pull)
  );
  if (moment === "closed") {
    if (
      existing &&
      ["proposed", "suggested", "open", "failed"].includes(existing.status)
    ) {
      // The feature is gone, so is its post.
      await dismissFinding(organizationId, existing.id).catch(() => undefined);
      logInfo("autopilot.pull_request_closed", {
        organizationId,
        pullRequest: `${pull.repository}#${pull.number}`,
        finding: existing.id,
      });
    }
    return;
  }
  if (
    existing &&
    !(
      existing.status === "failed" &&
      (existing.evidence.failures ?? 0) < AUTOPILOT_FINDING_MAX_FAILURES
    )
  ) {
    if (moment === "merged" && existing.status === "proposed") {
      await notifyDraftReady(organizationId, existing, pull);
    }
    // Either way one look per pull request: it already happened.
    return;
  }
  if (!isPostCandidateTitle(pr.title)) {
    return;
  }
  const skipped = await commitFilterSkipReason({
    filters: eligible.commitFilters,
    repository: {
      owner: event.repository.owner.login,
      name: event.repository.name,
      fullName: event.repository.full_name,
    },
    pull,
    getOctokit: () =>
      getInstallationOctokit(organizationId, event.repository.owner.login),
  });
  if (skipped) {
    // Like a chore title: a filtered pull request never becomes a run.
    logInfo("autopilot.pull_request_filtered", {
      organizationId,
      pullRequest: `${pull.repository}#${pull.number}`,
      reason: skipped,
    });
    return;
  }
  await assessAndAct({ organizationId, event, pull, moment });
}

async function assessAndAct(params: {
  organizationId: string;
  event: AutopilotPullRequestEvent;
  pull: MergedPullRequest;
  moment: "ready" | "merged";
}) {
  const { organizationId, event, pull, moment } = params;
  const preview = await buildAutopilotRunContext(organizationId, "");
  const verdict = await assessPullRequestForPost({
    ctx: preview,
    log: silentAutopilotLogger,
    pull,
    // Below the offer bar the daily planner sees the merge like any other.
    minConfidence: AUTOPILOT_PR_OFFER_CONFIDENCE,
  });
  // Most pull requests end here; they become a run only when they lead somewhere.
  logInfo("autopilot.pull_request_check", {
    organizationId,
    moment,
    pullRequest: `${pull.repository}#${pull.number}`,
    worth: verdict?.worth ?? null,
    confidence: verdict?.confidence ?? null,
    probabilities: verdict?.probabilities ?? null,
  });
  if (!verdict?.worth) {
    return;
  }

  const runId = await createItemAutopilotRun(organizationId, "github");
  const ctx = { ...preview, runId };
  const log = createAutopilotLogger(ctx, "commits");
  const result: AutopilotJobResult = { findingIds: [], insights: [] };
  let error: string | undefined;
  try {
    await log.decision(
      `${pull.repository}#${pull.number} ${moment === "ready" ? "is ready for review" : "merged"} and looks worth a post`,
      { title: pull.title, confidence: verdict.confidence },
      { probabilities: verdict.probabilities, pull }
    );
    await proposeAndComment({ ctx, log, result, event, pull, verdict });
  } catch (failure) {
    error = toErrorMessage(failure, String(failure));
  } finally {
    await finishAutopilotRun({
      organizationId,
      runId,
      results: [result],
      slackMessageTs: null,
      scheduled: false,
      error,
    });
  }
}

async function proposeAndComment(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  result: AutopilotJobResult;
  event: AutopilotPullRequestEvent;
  pull: MergedPullRequest;
  verdict: { confidence: number };
}) {
  const { ctx, log, result, event, pull, verdict } = params;
  // Only ever an offer: a pull request event never writes on its own. A
  // reply asking for the post is the explicit request that writes it.
  const outcome = await proposeCommitPost({
    ctx,
    log,
    result,
    pull,
    confidence: verdict.confidence,
    decision: {
      considered: [],
      threshold: AUTOPILOT_PR_OFFER_CONFIDENCE,
      filteredOut: 0,
    },
    suggestOnly: true,
  });
  const comment =
    outcome.status === "suggested"
      ? await commentOnPullRequest({
          ctx,
          log,
          event,
          body: `**Should I write a post about this?** It looks like something your users would want to hear about (${percent(verdict.confidence)} sure). Reply \`@notra write a post\` and I'll draft it now, or reply \`@notra no\` (or react with 👎) and I'll skip it. I won't write it without a reply.`,
        })
      : null;
  if (comment && "findingId" in outcome && outcome.findingId) {
    await rememberOfferComment(outcome.findingId, {
      repository: event.repository.full_name,
      id: Number(comment.id),
    });
  }
}

/** The feature shipped: take the waiting draft out of draft and say so. */
async function notifyDraftReady(
  organizationId: string,
  finding: NonNullable<Awaited<ReturnType<typeof findFindingByFingerprint>>>,
  pull: MergedPullRequest
) {
  const [owner, repo] = finding.repository?.split("/") ?? [];
  if (!(owner && repo && finding.pullRequestNumber)) {
    return;
  }
  try {
    const octokit = await getRepositoryOctokit(organizationId, {
      owner,
      name: repo,
    });
    const state = await getContentPullRequestState(octokit, {
      owner,
      repo,
      pullNumber: finding.pullRequestNumber,
    });
    if (state.status !== "open") {
      return;
    }
    await markContentPullRequestReady(octokit, state);
    await postGitHubIssueComment({
      octokit,
      owner,
      repo,
      issueNumber: finding.pullRequestNumber,
      body: `${pull.url} was merged, so I marked this post ready for review. Merge it to publish.`,
    });
  } catch {
    // A missed nudge is harmless; the draft is still on the dashboard.
  }
}

async function commentOnPullRequest(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  event: AutopilotPullRequestEvent;
  body: string;
}) {
  const { ctx, log, event } = params;
  try {
    const octokit = await getRepositoryOctokit(ctx.organizationId, {
      owner: event.repository.owner.login,
      name: event.repository.name,
    });
    const comment = await postGitHubIssueComment({
      octokit,
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issueNumber: event.pull_request.number,
      body: params.body,
    });
    await log.action("Commented on the pull request", {
      url: comment.htmlUrl,
    });
    return comment;
  } catch (error) {
    await log.error("Could not comment on the pull request", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
