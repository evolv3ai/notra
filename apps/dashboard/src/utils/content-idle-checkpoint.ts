import {
  CONTENT_IDLE_CHECKPOINT_MS,
  CONTENT_IDLE_CHECKPOINT_RETRY_MS,
} from "@/constants/content-document-save";
import type { ContentIdleCheckpointOptions } from "@/types/content/document-save";
import { isTransientContentCheckpointError } from "@/utils/content-document-save";

export function createContentIdleCheckpoint(
  options: ContentIdleCheckpointOptions
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempted = new Set<number>();
  const captured = new Set<number>();
  const retried = new Set<number>();
  let generation = 0;
  const cancel = () => {
    generation += 1;
    clearTimeout(timer);
    timer = undefined;
  };
  return {
    cancel,
    schedule(revision: number) {
      cancel();
      if (attempted.has(revision) || captured.has(revision)) {
        return;
      }
      const scheduledGeneration = generation;
      const capture = () => {
        if (captured.has(revision) || scheduledGeneration !== generation) {
          return;
        }
        timer = undefined;
        attempted.add(revision);
        void options
          .checkpoint(revision)
          .then((didCapture) => {
            if (didCapture) {
              captured.add(revision);
            } else {
              attempted.delete(revision);
            }
          })
          .catch((error: unknown) => {
            options.onError(error);
            if (
              captured.has(revision) ||
              retried.has(revision) ||
              !isTransientContentCheckpointError(error)
            ) {
              return;
            }
            retried.add(revision);
            attempted.delete(revision);
            if (scheduledGeneration === generation) {
              timer = setTimeout(capture, CONTENT_IDLE_CHECKPOINT_RETRY_MS);
            }
          });
      };
      timer = setTimeout(capture, CONTENT_IDLE_CHECKPOINT_MS);
    },
    markCaptured(revision: number) {
      captured.add(revision);
      attempted.add(revision);
    },
  };
}
