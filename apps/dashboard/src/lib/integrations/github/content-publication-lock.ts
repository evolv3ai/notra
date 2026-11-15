import { withAdvisorySessionLocks } from "@notra/db/utils/advisory-session-lock";

/** Serialize publishing and removal for a post across editor, API and schedule requests. */
export async function withContentPublicationLock<T>(
  organizationId: string,
  contentId: string,
  run: () => Promise<T>
) {
  return await withAdvisorySessionLocks(
    [["content-publish", organizationId, contentId]],
    run
  );
}
