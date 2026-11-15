import { githubStatus } from "@notra/ai/utils/github-pr-commit";
import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";

import {
  AUTOPILOT_EXPIRED_COOLDOWN_MS,
  AUTOPILOT_PERSON_PULL_REQUEST_EVENTS,
  AUTOPILOT_PULL_REQUEST_LIST_PAGES,
} from "@/constants/autopilot";
import {
  deleteAutopilotBranch,
  pullRequestRef,
} from "@/lib/autopilot/findings";
import {
  AutopilotRepositoryAccessError,
  getRepositoryOctokit,
} from "@/lib/autopilot/github";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import type { AutopilotRunContext } from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotOctokit,
  AutopilotFindingRow as FindingRow,
  AutopilotPullRequestRef as PullRequestRef,
} from "@/types/autopilot-runtime";
import { parseCommitFingerprint } from "@/utils/autopilot-github";
import { toErrorMessage } from "@/utils/error-message";

const DAY_MS = 24 * 60 * 60 * 1000;

const isPerson = (user: { type?: string } | null | undefined) =>
  user?.type !== "Bot";

/** Every item of a GitHub list up to the page limit; truncated past it. */
async function listPages<T>(
  fetchPage: (page: number) => Promise<{ data: T[] }>
) {
  const items: T[] = [];
  for (let page = 1; page <= AUTOPILOT_PULL_REQUEST_LIST_PAGES; page += 1) {
    const { data } = await fetchPage(page);
    items.push(...data);
    if (data.length < 100) {
      return { items, truncated: false };
    }
  }
  return { items, truncated: true };
}

async function listPullRequestEvents(
  octokit: AutopilotOctokit,
  ref: PullRequestRef
) {
  const { items, truncated } = await listPages((page) =>
    octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/events", {
      owner: ref.owner,
      repo: ref.repo,
      issue_number: ref.pullNumber,
      per_page: 100,
      page,
    })
  );
  return { events: items, truncated };
}

type PullRequestEvents = Awaited<ReturnType<typeof listPullRequestEvents>>;

/** Past the page limit it counts as closed, so a long history never gets a reopened draft closed again. */
function wasEverClosed({ events, truncated }: PullRequestEvents) {
  return truncated || events.some((event) => event.event === "closed");
}

/**
 * Whether a person works on the pull request: reviewed, commented, pushed or
 * moved it in or out of draft since a moment, or took it over for good by
 * approving it or taking it out of draft. Autopilot leaves draft itself when
 * a post's feature merges, so a bot doing that counts for nothing. Missing
 * authors and dates count as a person's recent work, so unknown data never
 * gets a draft closed.
 */
async function personWorksOn(params: {
  octokit: AutopilotOctokit;
  ref: PullRequestRef;
  draft: boolean;
  events: PullRequestEvents;
  since: Date;
}) {
  const { octokit, ref, events, since } = params;
  const recent = (date: string | null | undefined) =>
    !date || new Date(date) >= since;
  const pullParams = {
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.pullNumber,
    per_page: 100,
  };
  if (
    events.truncated ||
    events.events.some(
      (event) =>
        AUTOPILOT_PERSON_PULL_REQUEST_EVENTS.has(event.event) &&
        isPerson(event.actor) &&
        (recent(event.created_at) ||
          (!params.draft && event.event === "ready_for_review"))
    )
  ) {
    return true;
  }
  const sinceIso = since.toISOString();
  const [reviews, comments, reviewComments, commits] = await Promise.all([
    listPages((page) =>
      octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
        ...pullParams,
        page,
      })
    ),
    listPages((page) =>
      octokit.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: ref.owner,
          repo: ref.repo,
          issue_number: ref.pullNumber,
          since: sinceIso,
          per_page: 100,
          page,
        }
      )
    ),
    listPages((page) =>
      octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        {
          ...pullParams,
          since: sinceIso,
          page,
        }
      )
    ),
    listPages((page) =>
      octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/commits", {
        ...pullParams,
        page,
      })
    ),
  ]);
  // Unread pages may hold recent work. GitHub lists at most 250 commits.
  if (
    [reviews, comments, reviewComments, commits].some(
      ({ truncated }) => truncated
    ) ||
    commits.items.length >= 250
  ) {
    return true;
  }
  return (
    reviews.items.some(
      (review) =>
        isPerson(review.user) &&
        (recent(review.submitted_at) || review.state === "APPROVED")
    ) ||
    comments.items.some((comment) => isPerson(comment.user)) ||
    reviewComments.items.some((comment) => isPerson(comment.user)) ||
    commits.items.some(
      (commit) =>
        isPerson(commit.author) && recent(commit.commit.committer?.date)
    )
  );
}

/**
 * When a draft became something to review. A post about shipped work waits
 * for its feature: while the feature pull request is open and someone works
 * on it, then from its merge. An abandoned or unreadable feature no longer
 * holds the post, which then ages from its own opening.
 */
async function reviewableSince(organizationId: string, finding: FindingRow) {
  const openedAt = finding.openedAt ?? finding.updatedAt;
  const source = parseCommitFingerprint(finding.fingerprint);
  if (!source) {
    return { since: openedAt, featureOpen: false };
  }
  const feature = await getRepositoryOctokit(organizationId, {
    owner: source.owner,
    name: source.repo,
  })
    .then((octokit) =>
      octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner: source.owner,
        repo: source.repo,
        pull_number: source.pullNumber,
      })
    )
    .then(({ data }) => data)
    .catch((error: unknown) => {
      // Only a feature Autopilot can't reach is let go; a GitHub hiccup
      // leaves the post for the next run instead of closing it early.
      if (
        error instanceof AutopilotRepositoryAccessError ||
        [404, 422].includes(githubStatus(error) ?? 0)
      ) {
        return null;
      }
      throw error;
    });
  const moved =
    feature?.merged_at ??
    (feature?.state === "open" ? feature.updated_at : null);
  const since =
    moved && new Date(moved) > openedAt ? new Date(moved) : openedAt;
  return { since, featureOpen: feature?.state === "open" };
}

/** Back to a live proposal, for drafts that are still or again open on GitHub. */
async function reviveExpired(findingId: string) {
  await db
    .update(autopilotFindings)
    .set({ status: "proposed", dismissedAt: null })
    .where(
      and(
        eq(autopilotFindings.id, findingId),
        eq(autopilotFindings.status, "expired")
      )
    );
}

/** Closes the draft on GitHub, says why, and removes its branch. */
async function closeDraft(params: {
  octokit: AutopilotOctokit;
  ref: PullRequestRef;
  finding: FindingRow;
  days: number;
  log: AutopilotLogger;
}) {
  const { octokit, ref, finding, days } = params;
  await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.pullNumber,
    state: "closed",
  });
  await octokit
    .request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: ref.owner,
      repo: ref.repo,
      issue_number: ref.pullNumber,
      body: `Closed this draft because nobody worked on it for ${days} days. Reopen it if you still want it; Notra doesn't count this as a no.`,
    })
    .catch(() => undefined);
  await deleteAutopilotBranch(octokit, ref, finding.branch);
  await params.log.action(
    `Closed #${ref.pullNumber}: untouched for ${days} days`,
    { url: finding.pullRequestUrl, title: finding.title }
  );
}

/**
 * Expired drafts whose pull request is open on GitHub. Without a "closed"
 * event the close never landed (a run stopped between recording and closing),
 * so it is finished now, unless someone worked on it since. With one, someone
 * reopened it and wants it after all, so it counts as open again. A merge
 * after reopening is recorded as a merge.
 */
async function reconcileExpired(
  ctx: AutopilotRunContext,
  log: AutopilotLogger,
  days: number | null
) {
  const expired = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, ctx.organizationId),
      eq(autopilotFindings.status, "expired"),
      gt(
        autopilotFindings.dismissedAt,
        new Date(Date.now() - AUTOPILOT_EXPIRED_COOLDOWN_MS)
      )
    ),
  });
  for (const finding of expired) {
    const ref = pullRequestRef(finding);
    if (!ref) {
      continue;
    }
    try {
      const octokit = await getRepositoryOctokit(ctx.organizationId, {
        owner: ref.owner,
        name: ref.repo,
      });
      const { data: pull } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner: ref.owner, repo: ref.repo, pull_number: ref.pullNumber }
      );
      if (pull.merged_at) {
        await db
          .update(autopilotFindings)
          .set({ status: "merged", mergedAt: new Date(pull.merged_at) })
          .where(
            and(
              eq(autopilotFindings.id, finding.id),
              eq(autopilotFindings.status, "expired")
            )
          );
        continue;
      }
      if (pull.state !== "open") {
        continue;
      }
      // Never closed means the run stopped before closing it. It is closed
      // now unless someone started working on it in the meantime.
      if (days) {
        const events = await listPullRequestEvents(octokit, ref);
        if (
          !(
            wasEverClosed(events) ||
            (await personWorksOn({
              octokit,
              ref,
              draft: Boolean(pull.draft),
              events,
              since: finding.dismissedAt ?? new Date(0),
            }))
          )
        ) {
          await closeDraft({ octokit, ref, finding, days, log });
          continue;
        }
      }
      await reviveExpired(finding.id);
      await log.action(
        `#${ref.pullNumber} is open, so it counts as a draft again`,
        { url: finding.pullRequestUrl }
      );
    } catch (error) {
      await log.error(`Could not check #${ref.pullNumber} on GitHub`, {
        error: toErrorMessage(error, String(error)),
      });
    }
  }
}

/**
 * Closes Autopilot drafts nobody worked on for the configured number of days,
 * so they stop counting against the open pull request limit. The finding
 * becomes expired, not dismissed: it is no "no", nothing is remembered from
 * it, and the topic may come back after a cooldown.
 */
export async function closeStalePullRequests(ctx: AutopilotRunContext) {
  const days = ctx.stalePullRequestDays;
  const log = createAutopilotLogger(ctx, null);
  await reconcileExpired(ctx, log, days);
  if (!days) {
    return 0;
  }
  const cutoff = new Date(Date.now() - days * DAY_MS);
  // updatedAt also moves when the brief mentions a draft, so it is no age.
  const candidates = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, ctx.organizationId),
      eq(autopilotFindings.status, "proposed"),
      or(
        lt(autopilotFindings.openedAt, cutoff),
        and(
          isNull(autopilotFindings.openedAt),
          lt(autopilotFindings.updatedAt, cutoff)
        )
      )
    ),
  });
  let closed = 0;
  for (const finding of candidates) {
    const ref = pullRequestRef(finding);
    if (!ref) {
      continue;
    }
    try {
      const octokit = await getRepositoryOctokit(ctx.organizationId, {
        owner: ref.owner,
        name: ref.repo,
      });
      const { data: pull } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner: ref.owner, repo: ref.repo, pull_number: ref.pullNumber }
      );
      if (pull.state !== "open") {
        // Merged or closed on GitHub; the regular sync records which.
        continue;
      }
      const reviewable = await reviewableSince(ctx.organizationId, finding);
      if (reviewable.since > cutoff) {
        if (reviewable.featureOpen) {
          await log.decision(
            `Kept #${ref.pullNumber} open: its feature pull request is still in progress`,
            { url: finding.pullRequestUrl }
          );
        }
        continue;
      }
      const events = await listPullRequestEvents(octokit, ref);
      if (
        await personWorksOn({
          octokit,
          ref,
          draft: Boolean(pull.draft),
          events,
          since: cutoff,
        })
      ) {
        await log.decision(
          `Kept #${ref.pullNumber} open: someone worked on it in the last ${days} days`,
          { url: finding.pullRequestUrl }
        );
        continue;
      }
      // Recorded first, so the "closed" webhook finds nothing to dismiss.
      const [expired] = await db
        .update(autopilotFindings)
        .set({ status: "expired", dismissedAt: new Date(), claimToken: null })
        .where(
          and(
            eq(autopilotFindings.id, finding.id),
            eq(autopilotFindings.status, "proposed")
          )
        )
        .returning({ id: autopilotFindings.id });
      if (!expired) {
        continue;
      }
      try {
        await closeDraft({ octokit, ref, finding, days, log });
      } catch (error) {
        // Still open on GitHub, so it has to stay a live proposal here too.
        await reviveExpired(finding.id);
        throw error;
      }
      closed += 1;
    } catch (error) {
      // GitHub access can lapse; the draft is looked at again tomorrow.
      await log.error(`Could not check #${ref.pullNumber} on GitHub`, {
        error: toErrorMessage(error, String(error)),
      });
    }
  }
  return closed;
}
