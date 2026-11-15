import { Data, Effect } from "effect";

import { DEMO_DISABLED_MESSAGE } from "@/constants/demo";

export class ActionFailure extends Data.TaggedError("ActionFailure")<{
  readonly message: string;
  readonly code?: string;
  readonly cause?: unknown;
}> {}

export const tryAction = <T>(run: () => Promise<T>, message: string) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new ActionFailure({ message, cause }),
  });

export const failDemoDisabled = Effect.fail(
  new ActionFailure({ message: DEMO_DISABLED_MESSAGE })
);
