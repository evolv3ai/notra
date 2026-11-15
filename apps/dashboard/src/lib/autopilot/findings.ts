import { createHash } from "node:crypto";

import { resolveGitHubMentionAuth } from "@notra/ai/utils/github-mention-auth";
import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
} from "@notra/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  AUTOPILOT_BRANCH_PREFIX,
  AUTOPILOT_EXPIRED_COOLDOWN_MS,
  AUTOPILOT_FINDING_CLAIM_LEASE_MS,
  AUTOPILOT_FINDING_MAX_FAILURES,
  AUTOPILOT_RUN_LEASE_MS,
} from "@/constants/autopilot";
import {
  AUTOPILOT_ITEM_RUN_TRIGGERS,
  AUTOPILOT_SETTLED_FINDING_STATUSES,
  AUTOPILOT_STALE_WRITER_MESSAGE,
} from "@/constants/autopilot-findings";
import { AUTOPILOT_MERGE_METHOD_LABELS } from "@/constants/autopilot-ui";
import { getRepositoryOctokit } from "@/lib/autopilot/github";
import { rememberFeedback } from "@/lib/autopilot/memory";
import {
  getContentPullRequestState,
  isMergeMethodNotAllowed,
  mergeContentPullRequest,
} from "@/lib/integrations/github/content-pull-request";
import type { AutopilotProposal } from "@/types/autopilot";
import type {
  AutopilotFindingRow as FindingRow,
  AutopilotPullRequestRef,
  FindingClaim,
} from "@/types/autopilot-runtime";
import type { GitHubMergeMethod } from "@/types/integrations/github";
import { autopilotReactionAcknowledgment } from "@/utils/autopilot-feedback";

/** Drafts closed as stale once their cooldown is over. */
function isExpiredPastCooldown(now: Date) {
  return and(
    eq(autopilotFindings.status, "expired"),
    lt(
      autopilotFindings.dismissedAt,
      new Date(now.getTime() - AUTOPILOT_EXPIRED_COOLDOWN_MS)
    )
  );
}

const failureCount = sql<number>`coalesce((${autopilotFindings.evidence}->>'failures')::int, 0)`;

/** Failed often enough that retrying would only burn tokens on the same error. */
function hasGivenUp() {
  return and(
    eq(autopilotFindings.status, "failed"),
    gte(failureCount, AUTOPILOT_FINDING_MAX_FAILURES)
  );
}

/**
 * Failed findings with retries left, stale drafts past their cooldown and
 * open ones whose writer stopped renewing are free to take.
 */
function isClaimable(now: Date) {
  return or(
    and(
      eq(autopilotFindings.status, "failed"),
      lt(failureCount, AUTOPILOT_FINDING_MAX_FAILURES)
    ),
    isExpiredPastCooldown(now),
    and(
      eq(autopilotFindings.status, "open"),
      or(
        isNull(autopilotFindings.claimedAt),
        lt(
          autopilotFindings.claimedAt,
          new Date(now.getTime() - AUTOPILOT_FINDING_CLAIM_LEASE_MS)
        )
      )
    )
  );
}

function heldBy(claim: FindingClaim) {
  return and(
    eq(autopilotFindings.id, claim.finding.id),
    eq(autopilotFindings.claimToken, claim.token),
    eq(autopilotFindings.status, "open")
  );
}

/**
 * Takes a fingerprint atomically. Two runs proposing the same thing at once
 * get one claim between them; settled findings and live claims return null.
 */
export async function claimFinding(
  organizationId: string,
  runId: string,
  proposal: AutopilotProposal,
  claimToken?: string
): Promise<FindingClaim | null> {
  const token = claimToken ?? nanoid();
  const now = new Date();
  if (claimToken) {
    const held = await db.query.autopilotFindings.findFirst({
      where: and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.fingerprint, proposal.fingerprint),
        eq(autopilotFindings.claimToken, claimToken),
        eq(autopilotFindings.status, "open")
      ),
    });
    if (held) {
      return { finding: held, token };
    }
  }
  const [inserted] = await db
    .insert(autopilotFindings)
    .values({
      id: nanoid(),
      organizationId,
      runId,
      kind: proposal.kind,
      fingerprint: proposal.fingerprint,
      title: proposal.title,
      summary: proposal.summary,
      evidence: proposal.evidence,
      status: "open",
      claimToken: token,
      claimedAt: now,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) {
    return { finding: inserted, token };
  }
  const [updated] = await db
    .update(autopilotFindings)
    .set({
      runId,
      title: proposal.title,
      summary: proposal.summary,
      evidence: sql`${JSON.stringify(proposal.evidence)}::jsonb || jsonb_strip_nulls(jsonb_build_object('failures', ${autopilotFindings.evidence}->'failures', 'briefed', ${autopilotFindings.evidence}->'briefed'))`,
      status: "open",
      errorMessage: null,
      claimToken: token,
      claimedAt: now,
    })
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.fingerprint, proposal.fingerprint),
        isClaimable(now)
      )
    )
    .returning();
  return updated ? { finding: updated, token } : null;
}

/**
 * Takes a suggestion for writing on someone's request (a click or a reply);
 * null when someone else has it. Marked requested, so it never counts against
 * the budget for pull requests Autopilot opens on its own.
 */
export async function claimSuggestedFinding(
  organizationId: string,
  findingId: string,
  runId: string
): Promise<FindingClaim | null> {
  const token = nanoid();
  const now = new Date();
  const [updated] = await db
    .update(autopilotFindings)
    .set({
      runId,
      status: "open",
      errorMessage: null,
      claimToken: token,
      claimedAt: now,
      evidence: sql`${autopilotFindings.evidence} || '{"requested":true}'::jsonb`,
    })
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.id, findingId),
        or(eq(autopilotFindings.status, "suggested"), isClaimable(now))
      )
    )
    .returning();
  return updated ? { finding: updated, token } : null;
}

/**
 * Records the pull request. Returns false when the claim was lost (dismissed
 * or taken over while writing); the caller then closes what it opened.
 */
export async function markFindingProposed(
  claim: FindingClaim,
  pullRequest: {
    repository: string;
    number: number;
    url: string;
    branch: string;
    headSha: string;
  },
  details?: Partial<Pick<FindingRow, "title" | "summary" | "evidence">>
) {
  const evidence = details?.evidence
    ? sql`${JSON.stringify(details.evidence)}::jsonb`
    : autopilotFindings.evidence;
  const rows = await db
    .update(autopilotFindings)
    .set({
      ...details,
      evidence: sql`jsonb_set(${evidence}, '{briefed}', coalesce(${autopilotFindings.evidence}->'briefed', '[]'::jsonb) - 'proposed')`,
      status: "proposed",
      repository: pullRequest.repository,
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.url,
      branch: pullRequest.branch,
      headSha: pullRequest.headSha,
      openedAt: new Date(),
      errorMessage: null,
      claimToken: null,
    })
    .where(heldBy(claim))
    .returning({ id: autopilotFindings.id });
  return rows.length > 0;
}

export async function markFindingSuggested(claim: FindingClaim) {
  await db
    .update(autopilotFindings)
    .set({ status: "suggested", claimToken: null })
    .where(heldBy(claim));
}

/** A failed suggestion goes back on the dashboard so it can be tried again. */
export async function returnFindingToSuggested(
  claim: FindingClaim,
  error: unknown
) {
  await db
    .update(autopilotFindings)
    .set({
      status: "suggested",
      claimToken: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    .where(heldBy(claim));
}

/**
 * The writer looked and found nothing to change. Settled as dismissed so the
 * same fingerprint is not retried every day, without muting any issue: a
 * changed issue set gets a new fingerprint and a fresh look.
 */
export async function markFindingWithoutChange(
  claim: FindingClaim,
  reason: string
) {
  await db
    .update(autopilotFindings)
    .set({
      status: "dismissed",
      dismissedAt: new Date(),
      claimToken: null,
      errorMessage: reason,
      evidence: { ...claim.finding.evidence, issueIds: [] },
    })
    .where(heldBy(claim));
}

/** Settles a held finding as declined, e.g. after "@notra no". */
export async function dismissClaimedFinding(
  claim: FindingClaim,
  reason: string
) {
  await db
    .update(autopilotFindings)
    .set({
      status: "dismissed",
      dismissedAt: new Date(),
      claimToken: null,
      errorMessage: reason,
    })
    .where(heldBy(claim));
}

/**
 * Counts the failure; past the limit the daily run stops picking it again.
 * Returns true when this was the last try. `count: false` is for retries that
 * say nothing about the finding itself, like running out of credits.
 */
export async function markFindingFailed(
  claim: FindingClaim,
  error: unknown,
  { count = true }: { count?: boolean } = {}
) {
  const [row] = await db
    .update(autopilotFindings)
    .set({
      status: "failed",
      claimToken: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...(count
        ? {
            evidence: sql`jsonb_set(${autopilotFindings.evidence}, '{failures}', to_jsonb(${failureCount} + 1))`,
          }
        : {}),
    })
    .where(heldBy(claim))
    .returning({ evidence: autopilotFindings.evidence });
  return (row?.evidence.failures ?? 0) >= AUTOPILOT_FINDING_MAX_FAILURES;
}

export function findFindingByFingerprint(
  organizationId: string,
  fingerprint: string
) {
  return db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.fingerprint, fingerprint)
    ),
  });
}

/** Remembers Notra's offer comment so a thumbs down on it can be read later. */
export async function rememberOfferComment(
  findingId: string,
  offerComment: { repository: string; id: number }
) {
  await db
    .update(autopilotFindings)
    .set({
      evidence: sql`${autopilotFindings.evidence} || ${JSON.stringify({ offerComment })}::jsonb`,
    })
    .where(eq(autopilotFindings.id, findingId));
}

/**
 * Dismisses a finding only while it is still a suggestion. A finding that a
 * writer picked up or turned into a pull request in the meantime is left
 * alone; returns false then.
 */
export async function dismissSuggestedFinding(
  organizationId: string,
  findingId: string
) {
  const rows = await db
    .update(autopilotFindings)
    .set({ status: "dismissed", dismissedAt: new Date(), claimToken: null })
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.id, findingId),
        eq(autopilotFindings.status, "suggested")
      )
    )
    .returning({ id: autopilotFindings.id });
  return rows.length > 0;
}

/**
 * GitHub sends no reaction webhook. The cron syncs current member votes to
 * the workspace memory and edits the offer with a single acknowledgment. Only a thumbs
 * down can dismiss a suggestion; neither vote changes an existing draft.
 */
export async function syncOfferReactionFeedback(
  organizationId: string,
  since: Date
) {
  const offered = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      or(
        gte(autopilotFindings.createdAt, since),
        sql`${autopilotFindings.evidence}->>'feedbackPending' = 'true'`
      ),
      sql`${autopilotFindings.evidence} ? 'offerComment'`
    ),
  });
  const dismissed: string[] = [];
  let failures = 0;
  for (const candidate of offered) {
    try {
      const failed = await db.transaction(async (tx) => {
        // The candidate list is only discovery. Lock and reread before GitHub so
        // overlapping cron/job instances cannot apply an older vote snapshot last.
        const [finding] = await tx
          .select()
          .from(autopilotFindings)
          .where(
            and(
              eq(autopilotFindings.organizationId, organizationId),
              eq(autopilotFindings.id, candidate.id)
            )
          )
          .for("update");
        const offer = finding?.evidence.offerComment;
        const [owner, repo] = offer?.repository.split("/") ?? [];
        if (!(finding && offer && owner && repo)) {
          return false;
        }
        try {
          const octokit = await getRepositoryOctokit(organizationId, {
            owner,
            name: repo,
          });
          const votes = [];
          for (let page = 1; ; page += 1) {
            const { data } = await octokit.request(
              "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
              { owner, repo, comment_id: offer.id, per_page: 100, page }
            );
            for (const reaction of data) {
              if (
                !reaction.user ||
                reaction.user.type === "Bot" ||
                (reaction.content !== "+1" && reaction.content !== "-1")
              ) {
                continue;
              }
              const auth = await resolveGitHubMentionAuth({
                githubUserId: Number(reaction.user.id),
                organizationId,
              });
              if (auth) {
                votes.push({
                  user: Number(reaction.user.id),
                  content: reaction.content,
                });
              }
            }
            if (data.length < 100) {
              break;
            }
          }
          votes.sort(
            (a, b) => a.user - b.user || a.content.localeCompare(b.content)
          );
          const receipt = createHash("sha256")
            .update(JSON.stringify(votes))
            .digest("hex");
          if (
            (!finding.evidence.feedbackPending &&
              receipt === finding.evidence.feedbackReceipt) ||
            (!finding.evidence.feedbackPending &&
              !votes.length &&
              !finding.evidence.feedbackReceipt)
          ) {
            return false;
          }
          const sourceUrl = finding.evidence.pullRequests?.[0]?.url;
          if (!sourceUrl) {
            return false;
          }
          let status = finding.status;
          if (votes.some((vote) => vote.content === "-1")) {
            const rows = await tx
              .update(autopilotFindings)
              .set({
                status: "dismissed",
                dismissedAt: new Date(),
                claimToken: null,
              })
              .where(
                and(
                  eq(autopilotFindings.id, finding.id),
                  eq(autopilotFindings.status, "suggested")
                )
              )
              .returning({ id: autopilotFindings.id });
            if (rows.length) {
              status = "dismissed";
              dismissed.push(finding.title);
            }
          }
          // Replace the current snapshot, including retractions. No historical vote is a rule.
          await tx
            .update(autopilotFindings)
            .set({
              evidence: sql`${autopilotFindings.evidence} || '{"feedbackPending":true}'::jsonb`,
            })
            .where(
              and(
                eq(autopilotFindings.organizationId, organizationId),
                eq(autopilotFindings.id, finding.id)
              )
            );
          await rememberFeedback({
            organizationId,
            id: `autopilot-reactions-${finding.id}`,
            sourceUrl: `${sourceUrl}#issuecomment-${offer.id}`,
            createdBy: "workspace members",
            text: `${finding.title}\n${finding.summary}\nCurrent member reactions: ${JSON.stringify(votes)}. A thumbs up is positive interest, not permission to write. A thumbs down rejects this suggestion only. No reactions means prior feedback was retracted.`,
          });
          const { data: comment } = await octokit.request(
            "GET /repos/{owner}/{repo}/issues/comments/{comment_id}",
            { owner, repo, comment_id: offer.id }
          );
          const body =
            (comment.body ?? "").split("\n\n<!-- autopilot-feedback -->")[0] ??
            "";
          const acknowledgment = autopilotReactionAcknowledgment(votes, status);
          await octokit.request(
            "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
            {
              owner,
              repo,
              comment_id: offer.id,
              body: acknowledgment
                ? `${body}\n\n<!-- autopilot-feedback -->\n${acknowledgment}`
                : body,
            }
          );
          await tx
            .update(autopilotFindings)
            .set({
              evidence: sql`${autopilotFindings.evidence} || ${JSON.stringify({ feedbackReceipt: receipt, feedbackPending: false })}::jsonb`,
            })
            .where(
              and(
                eq(autopilotFindings.organizationId, organizationId),
                eq(autopilotFindings.id, finding.id)
              )
            );
          return false;
        } catch (cause) {
          if (
            cause instanceof Error &&
            cause.name === "HttpError" &&
            "status" in cause &&
            (cause.status === 404 || cause.status === 410)
          ) {
            return false;
          }
          // Commit pending even on remote failures so offers retry beyond the age
          // window. All finding writes use tx; a nested db write would deadlock.
          await tx
            .update(autopilotFindings)
            .set({
              evidence: sql`${autopilotFindings.evidence} || '{"feedbackPending":true}'::jsonb`,
            })
            .where(eq(autopilotFindings.id, finding.id));
          return true;
        }
      });
      if (failed) {
        failures += 1;
      }
    } catch {
      failures += 1;
    }
  }
  if (failures) {
    throw new Error(
      `Could not process feedback for ${failures} Autopilot offers`
    );
  }
  return dismissed;
}

/** True while one of these jobs still has a pull request waiting for review. */
export async function hasOpenProposal(
  organizationId: string,
  kinds: FindingRow["kind"][]
) {
  const open = await db.query.autopilotFindings.findFirst({
    columns: { id: true },
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      inArray(autopilotFindings.kind, kinds),
      eq(autopilotFindings.status, "proposed")
    ),
  });
  return Boolean(open);
}

/** This kind's latest pull request: when it opened and when it was merged or closed. */
export function findLatestProposal(
  organizationId: string,
  kind: FindingRow["kind"]
) {
  return db.query.autopilotFindings.findFirst({
    columns: { openedAt: true, mergedAt: true, dismissedAt: true },
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.kind, kind),
      isNotNull(autopilotFindings.openedAt)
    ),
    orderBy: [desc(autopilotFindings.openedAt)],
  });
}

/**
 * Pull requests the planner opened on its own since the cutoff. Explicit
 * requests do not count: a direct mention has no topic, and a clicked or
 * answered idea is marked requested.
 */
export async function countAutonomousProposals(
  organizationId: string,
  since: Date
) {
  const rows = await db
    .select({ id: autopilotFindings.id })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        inArray(autopilotFindings.kind, ["keywords", "commits"]),
        gte(autopilotFindings.openedAt, since),
        sql`${autopilotFindings.evidence} ? 'topic'`,
        sql`coalesce((${autopilotFindings.evidence}->>'requested')::boolean, false) = false`
      )
    );
  return rows.length;
}

/** Posts being written, waiting as ideas or open as drafts: the planner must not double them. */
export function listActiveBlogFindings(organizationId: string) {
  return db
    .select({
      id: autopilotFindings.id,
      title: autopilotFindings.title,
      status: autopilotFindings.status,
      topicSlug: sql<
        string | null
      >`${autopilotFindings.evidence}->'topic'->>'slug'`,
    })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        inArray(autopilotFindings.kind, ["keywords", "commits"]),
        inArray(autopilotFindings.status, ["open", "suggested", "proposed"])
      )
    );
}

export function listFindingStatuses(organizationId: string, ids: string[]) {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return db
    .select({
      id: autopilotFindings.id,
      status: autopilotFindings.status,
      pullRequestUrl: autopilotFindings.pullRequestUrl,
    })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        inArray(autopilotFindings.id, ids)
      )
    );
}

/** Fingerprints a job must not propose again, so it can skip them before spending tokens. */
export async function listSettledFingerprints(
  organizationId: string,
  kind: FindingRow["kind"]
) {
  const rows = await db
    .select({ fingerprint: autopilotFindings.fingerprint })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.kind, kind),
        or(
          inArray(autopilotFindings.status, [
            ...AUTOPILOT_SETTLED_FINDING_STATUSES,
          ]),
          hasGivenUp(),
          and(
            eq(autopilotFindings.status, "expired"),
            gte(
              autopilotFindings.dismissedAt,
              new Date(Date.now() - AUTOPILOT_EXPIRED_COOLDOWN_MS)
            )
          )
        )
      )
    );
  return new Set(rows.map((row) => row.fingerprint));
}

/** Readiness issues whose fix pull request was closed; Autopilot stops proposing them. */
export async function listDismissedReadinessIssueIds(organizationId: string) {
  const rows = await db
    .select({ evidence: autopilotFindings.evidence })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.kind, "readiness"),
        eq(autopilotFindings.status, "dismissed")
      )
    );
  return new Set(rows.flatMap((row) => row.evidence.issueIds ?? []));
}

/** Includes owned writer reservations, not suggestion-only claims. Stale recovery frees dead slots. */
function occupiesDraftSlot() {
  return or(
    eq(autopilotFindings.status, "proposed"),
    and(
      eq(autopilotFindings.status, "open"),
      sql`${autopilotFindings.evidence}->>'draftSlot' = ${autopilotFindings.claimToken}`
    )
  );
}

/** Serializes slot admission only; no external work runs under the database lock. */
export async function reserveDraftSlot(
  claim: FindingClaim,
  limit: number | null
) {
  await recoverStaleFindings(claim.finding.organizationId);
  return db.transaction(async (tx) => {
    const [settings] = await tx
      .select({
        organizationId: autopilotSettings.organizationId,
        maxOpenPullRequests: autopilotSettings.maxOpenPullRequests,
      })
      .from(autopilotSettings)
      .where(eq(autopilotSettings.organizationId, claim.finding.organizationId))
      .for("update");
    if (!settings) {
      return "lost" as const;
    }
    const others = await tx
      .select({ id: autopilotFindings.id })
      .from(autopilotFindings)
      .where(
        and(
          eq(autopilotFindings.organizationId, claim.finding.organizationId),
          ne(autopilotFindings.id, claim.finding.id),
          occupiesDraftSlot()
        )
      );
    if (
      limit !== null &&
      others.length >= Math.min(limit, settings.maxOpenPullRequests)
    ) {
      return "full" as const;
    }
    const held = await tx
      .update(autopilotFindings)
      .set({
        evidence: sql`${autopilotFindings.evidence} || ${JSON.stringify({ draftSlot: claim.token })}::jsonb`,
      })
      .where(heldBy(claim))
      .returning({ id: autopilotFindings.id });
    return held.length ? ("reserved" as const) : ("lost" as const);
  });
}

export async function countOpenPullRequests(organizationId: string) {
  await recoverStaleFindings(organizationId);
  const rows = await db
    .select({ id: autopilotFindings.id })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        occupiesDraftSlot()
      )
    );
  return rows.length;
}

/**
 * Settles writes whose writer died (a crash or timeout after the response)
 * so the dashboard stops showing them as being written and they can be
 * tried again: a finding with a brief goes back to suggested, one without
 * to failed, where the next daily run picks it up. Only expired claims are
 * touched; a full run still inside its own lease keeps its findings. The
 * item run that held the claim is closed with it.
 */
export async function recoverStaleFindings(
  organizationId: string,
  now = new Date()
) {
  const leaseCutoff = new Date(
    now.getTime() - AUTOPILOT_FINDING_CLAIM_LEASE_MS
  );
  const stale = and(
    eq(autopilotFindings.organizationId, organizationId),
    eq(autopilotFindings.status, "open"),
    or(
      isNull(autopilotFindings.claimedAt),
      lt(autopilotFindings.claimedAt, leaseCutoff)
    ),
    notExists(
      db
        .select({ id: autopilotRuns.id })
        .from(autopilotRuns)
        .where(
          and(
            eq(autopilotRuns.id, autopilotFindings.runId),
            eq(autopilotRuns.organizationId, organizationId),
            eq(autopilotRuns.status, "running"),
            gte(
              autopilotRuns.heartbeatAt,
              new Date(now.getTime() - AUTOPILOT_RUN_LEASE_MS)
            ),
            inArray(autopilotRuns.trigger, [...AUTOPILOT_SCHEDULED_TRIGGERS])
          )
        )
    )
  );
  const hasBrief = sql`${autopilotFindings.evidence} ? 'brief'`;
  const recovered = [
    ...(await db
      .update(autopilotFindings)
      .set({
        status: "suggested",
        claimToken: null,
        errorMessage: AUTOPILOT_STALE_WRITER_MESSAGE,
      })
      .where(and(stale, hasBrief))
      .returning({ runId: autopilotFindings.runId })),
    ...(await db
      .update(autopilotFindings)
      .set({
        status: "failed",
        claimToken: null,
        errorMessage: AUTOPILOT_STALE_WRITER_MESSAGE,
      })
      .where(and(stale, sql`not (${hasBrief})`))
      .returning({ runId: autopilotFindings.runId })),
  ];
  const runIds = [
    ...new Set(recovered.flatMap((row) => (row.runId ? [row.runId] : []))),
  ];
  const itemRun = and(
    eq(autopilotRuns.organizationId, organizationId),
    eq(autopilotRuns.status, "running"),
    inArray(autopilotRuns.trigger, [...AUTOPILOT_ITEM_RUN_TRIGGERS])
  );
  await db
    .update(autopilotRuns)
    .set({
      status: "failed",
      finishedAt: now,
      errorMessage: AUTOPILOT_STALE_WRITER_MESSAGE,
    })
    .where(
      and(
        itemRun,
        or(
          // The run whose claim just expired.
          runIds.length > 0
            ? and(
                inArray(autopilotRuns.id, runIds),
                lt(autopilotRuns.heartbeatAt, leaseCutoff)
              )
            : undefined,
          // One that died before it claimed anything.
          lt(
            autopilotRuns.heartbeatAt,
            new Date(now.getTime() - AUTOPILOT_RUN_LEASE_MS)
          )
        )
      )
    );
  return recovered.length;
}

export async function listFindings(organizationId: string) {
  await recoverStaleFindings(organizationId);
  return db.query.autopilotFindings.findMany({
    where: eq(autopilotFindings.organizationId, organizationId),
    orderBy: [desc(autopilotFindings.updatedAt)],
    limit: 100,
  });
}

async function loadProposedFinding(organizationId: string, findingId: string) {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  if (!finding) {
    throw new Error("Finding not found");
  }
  return finding;
}

export function pullRequestRef(
  finding: FindingRow
): AutopilotPullRequestRef | null {
  if (!(finding.repository && finding.pullRequestNumber)) {
    return null;
  }
  const [owner, repo] = finding.repository.split("/");
  if (!(owner && repo)) {
    return null;
  }
  return { owner, repo, pullNumber: finding.pullRequestNumber };
}

/** Removes the Autopilot branch once its pull request is merged or closed; best effort. */
export async function deleteAutopilotBranch(
  octokit: Awaited<ReturnType<typeof getRepositoryOctokit>>,
  ref: AutopilotPullRequestRef,
  branch: string | null
) {
  if (!branch?.startsWith(`${AUTOPILOT_BRANCH_PREFIX}/`)) {
    return;
  }
  await octokit
    .request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: ref.owner,
      repo: ref.repo,
      ref: `heads/${branch}`,
    })
    .catch(() => undefined);
}

/** Pulls the pull request state from GitHub so merges and closes made there show up. */
export async function syncFindingPullRequests(organizationId: string) {
  const proposed = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.status, "proposed")
    ),
  });
  for (const finding of proposed) {
    const ref = pullRequestRef(finding);
    if (!ref) {
      continue;
    }
    try {
      const octokit = await getRepositoryOctokit(organizationId, {
        owner: ref.owner,
        name: ref.repo,
      });
      const state = await getContentPullRequestState(octokit, ref);
      // Only the row as read: cleanup may have expired it meanwhile, and
      // closing that pull request must not turn into a permanent dismissal.
      const unchanged = and(
        eq(autopilotFindings.id, finding.id),
        eq(autopilotFindings.status, "proposed"),
        eq(autopilotFindings.pullRequestNumber, ref.pullNumber)
      );
      if (state.status === "merged") {
        await db
          .update(autopilotFindings)
          .set({ status: "merged", mergedAt: state.mergedAt ?? new Date() })
          .where(unchanged);
      } else if (state.status === "closed") {
        await db
          .update(autopilotFindings)
          .set({ status: "dismissed", dismissedAt: new Date() })
          .where(unchanged);
      }
      if (state.status !== "open") {
        await deleteAutopilotBranch(octokit, ref, finding.branch);
      }
    } catch {
      // GitHub access can lapse; the next sync retries.
    }
  }
}

export async function mergeFinding(
  organizationId: string,
  findingId: string,
  method?: GitHubMergeMethod
) {
  const finding = await loadProposedFinding(organizationId, findingId);
  if (finding.status === "merged") {
    return finding;
  }
  const ref = pullRequestRef(finding);
  if (finding.status !== "proposed" || !ref) {
    throw new Error("This finding has no open pull request");
  }
  const octokit = await getRepositoryOctokit(organizationId, {
    owner: ref.owner,
    name: ref.repo,
  });
  const state = await getContentPullRequestState(octokit, ref);
  if (state.status === "open") {
    // Pinned to the commit Autopilot pushed: anything pushed after the review is never merged.
    try {
      await mergeContentPullRequest(
        octokit,
        ref,
        state,
        finding.headSha,
        method
      );
    } catch (error) {
      if (method && isMergeMethodNotAllowed(error)) {
        throw new Error(
          `This repository doesn't allow ${AUTOPILOT_MERGE_METHOD_LABELS[method].toLowerCase()}. Pick another way to merge.`
        );
      }
      throw error;
    }
  } else if (state.status === "closed") {
    throw new Error("The pull request was closed on GitHub");
  }
  await deleteAutopilotBranch(octokit, ref, finding.branch);
  const [updated] = await db
    .update(autopilotFindings)
    .set({ status: "merged", mergedAt: new Date() })
    .where(eq(autopilotFindings.id, finding.id))
    .returning();
  return updated ?? finding;
}

export async function dismissFinding(
  organizationId: string,
  findingId: string
): Promise<FindingRow> {
  const finding = await loadProposedFinding(organizationId, findingId);
  if (finding.status === "dismissed") {
    return finding;
  }
  if (finding.status === "merged") {
    throw new Error("This post is already merged");
  }
  const ref = pullRequestRef(finding);
  if (finding.status === "proposed" && ref) {
    const octokit = await getRepositoryOctokit(organizationId, {
      owner: ref.owner,
      name: ref.repo,
    });
    await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.pullNumber,
      state: "closed",
    });
    await deleteAutopilotBranch(octokit, ref, finding.branch);
  }
  // Clearing the claim makes a writer still running for it close its pull request.
  const [updated] = await db
    .update(autopilotFindings)
    .set({ status: "dismissed", dismissedAt: new Date(), claimToken: null })
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.id, finding.id),
        // If an open writer just recorded a PR, reload and close that PR too.
        eq(autopilotFindings.status, finding.status)
      )
    )
    .returning();
  if (updated) {
    return updated;
  }
  const current = await loadProposedFinding(organizationId, findingId);
  if (current.status === "merged") {
    throw new Error("This post is already merged");
  }
  return current.status === "dismissed"
    ? current
    : dismissFinding(organizationId, findingId);
}
