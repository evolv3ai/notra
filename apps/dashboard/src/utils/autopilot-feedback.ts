import type { GitHubMentionContext } from "@notra/ai/types/github-mention";
import type { AutopilotFindingStatus } from "@notra/db/types/autopilot";

export function autopilotDiscussionId(
  context: GitHubMentionContext,
  findingId: string
) {
  const thread = context.comment.review
    ? `review-${context.comment.review.rootCommentId}`
    : "issue";
  return `autopilot-discussion-${findingId}-${context.sender.id}-${thread}`;
}

/**
 * The line Autopilot appends to its offer once member reactions are saved.
 * Null when every reaction was taken back, so the offer reads as new again.
 */
export function autopilotReactionAcknowledgment(
  votes: ReadonlyArray<{ content: string }>,
  status: AutopilotFindingStatus
) {
  if (votes.some((vote) => vote.content === "-1")) {
    if (status === "dismissed") {
      return "Got your 👎, so I'll skip this one. Reply with `@notra` and tell me why, and I'll keep it in mind.";
    }
    if (status === "open") {
      return "Got your 👎. I've already started writing this one.";
    }
    if (status === "proposed") {
      return "Got your 👎. I already drafted this one, so close the draft if you don't want it.";
    }
    return "Got your 👎, noted.";
  }
  if (votes.length === 0) {
    return null;
  }
  return status === "suggested"
    ? "Thanks for the 👍, noted. I'll still draft it on schedule; reply `@notra write a post` if you want it sooner."
    : "Thanks for the 👍, noted.";
}
