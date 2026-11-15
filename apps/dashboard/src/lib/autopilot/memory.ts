import { parsePlannerState } from "@notra/ai/utils/autopilot-planner";
import {
  MEMORY_PATHS,
  MEMORY_PRELOADED_SOFT_LIMIT_BYTES,
} from "@notra/memory/constants/memory";
import {
  deleteMemory,
  openMemorySnapshot,
  updateMemory,
} from "@notra/memory/memory";
import type { MemoryRecord } from "@notra/memory/types/records";
import { byteLength } from "@notra/memory/utils/access";
import { parseRecords, renderRecords } from "@notra/memory/utils/records";

import {
  AUTOPILOT_FEEDBACK_INTRO,
  AUTOPILOT_FEEDBACK_TITLE_MAX_CHARS,
} from "@/constants/autopilot";
import type { AutopilotFeedbackInput } from "@/types/autopilot-memory";

function renderFeedback(records: readonly MemoryRecord[]) {
  return renderRecords({
    title: "Feedback",
    intro: AUTOPILOT_FEEDBACK_INTRO,
    records,
  });
}

/**
 * Feedback is preloaded into every decision, so it stays under the soft limit:
 * the oldest notes go first. Git history keeps what was dropped.
 */
function compactFeedback(records: MemoryRecord[]) {
  const sorted = [...records].sort((a, b) =>
    String(a.meta.createdAt ?? "").localeCompare(String(b.meta.createdAt ?? ""))
  );
  while (
    sorted.length > 1 &&
    byteLength(renderFeedback(sorted)) > MEMORY_PRELOADED_SOFT_LIMIT_BYTES
  ) {
    sorted.shift();
  }
  return sorted;
}

/** Replaces the note with the same id, so a retraction supersedes the old words. */
export async function rememberFeedback(params: AutopilotFeedbackInput) {
  const [subject = params.text] = params.text.split("\n");
  await updateMemory({
    organizationId: params.organizationId,
    actor: "user",
    message: `Feedback from ${params.createdBy}`,
    mutate: async (snapshot) => {
      const records = parseRecords(
        await snapshot.read(MEMORY_PATHS.feedback),
        "feedback"
      ).filter((record) => record.id !== params.id);
      records.push({
        id: params.id,
        title: subject.slice(0, AUTOPILOT_FEEDBACK_TITLE_MAX_CHARS),
        body: params.text,
        meta: {
          origin: params.origin ?? "github",
          sourceUrl: params.sourceUrl,
          createdBy: params.createdBy,
          createdAt: new Date().toISOString(),
        },
      });
      return {
        [MEMORY_PATHS.feedback]: renderFeedback(compactFeedback(records)),
      };
    },
  });
}

/** Idempotent cleanup; the deletion outbox retains failures for the next sweep. */
export async function deleteAutopilotMemory(
  organizationId: string,
  signal?: AbortSignal
) {
  await deleteMemory(organizationId, { signal });
}

/**
 * Observations behind topics the planner called ready and has not acted on.
 * The planner acts only on a topic something seen this run belongs to, so
 * these go to it again.
 */
export async function listReadyTopicObservationIds(organizationId: string) {
  try {
    const snapshot = await openMemorySnapshot(organizationId);
    const state = parsePlannerState(await snapshot.read(MEMORY_PATHS.planner));
    return new Set(
      state.topics
        // A topic with a finding already counts as active work.
        .filter((topic) => topic.status === "ready" && !topic.findingId)
        .flatMap((topic) => topic.signals.map((signal) => signal.observationId))
    );
  } catch {
    return new Set<string>();
  }
}
