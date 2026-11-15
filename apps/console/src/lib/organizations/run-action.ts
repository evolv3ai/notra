import { Effect } from "effect";
import { unstable_rethrow } from "next/navigation";

import { OrganizationActionError } from "@/lib/organizations/errors";
import type { ActionResult } from "@/types/organization";

export async function runOrganizationAction<T>(
  effect: Effect.Effect<T, OrganizationActionError>
): Promise<ActionResult<T>> {
  let failureCause: unknown;
  const result = await Effect.runPromise(
    effect.pipe(
      Effect.catchDefect((defect) =>
        Effect.fail(
          new OrganizationActionError({
            message: "Something went wrong",
            cause: defect,
          })
        )
      ),
      Effect.match({
        onSuccess: (data): ActionResult<T> => ({ data, error: null }),
        onFailure: (error): ActionResult<T> => {
          failureCause = error.cause;
          return { data: null, error: { message: error.message } };
        },
      })
    )
  );
  unstable_rethrow(failureCause);
  return result;
}
