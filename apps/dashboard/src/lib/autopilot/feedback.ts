import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import type { AutopilotFeedbackUpdate } from "@/types/autopilot-memory";
import { autopilotDiscussionId } from "@/utils/autopilot-feedback";

/** Serialize cross-instance writes and reject delayed deliveries after model work. */
export function applyFeedbackInOrder(params: AutopilotFeedbackUpdate) {
  const { context, findingId } = params;
  const documentId = autopilotDiscussionId(context, findingId);
  const version = {
    commentId: context.comment.id,
    updatedAt: context.comment.updatedAt ?? "1970-01-01T00:00:00Z",
  };
  return db.transaction(async (tx) => {
    const [finding] = await tx
      .select({ evidence: autopilotFindings.evidence })
      .from(autopilotFindings)
      .where(
        and(
          eq(autopilotFindings.organizationId, context.organizationId),
          eq(autopilotFindings.id, findingId)
        )
      )
      .for("update");
    if (!finding) {
      return false;
    }
    const prior = finding.evidence.feedbackVersions?.[documentId];
    if (
      prior &&
      (prior.commentId > version.commentId ||
        (prior.commentId === version.commentId &&
          Date.parse(prior.updatedAt) >= Date.parse(version.updatedAt)))
    ) {
      return false;
    }
    // Keep the row lock through persistence: a newer delivery cannot be overwritten
    // by an older remote request that finishes later. Failures leave no receipt.
    await params.apply(documentId);
    await tx
      .update(autopilotFindings)
      .set({
        evidence: {
          ...finding.evidence,
          feedbackVersions: {
            ...finding.evidence.feedbackVersions,
            [documentId]: version,
          },
        },
      })
      .where(eq(autopilotFindings.id, findingId));
    return true;
  });
}
