import { Effect } from "effect";

export async function runServiceEffect<A, E>(effect: Effect.Effect<A, E>) {
  const result = await Effect.runPromise(Effect.result(effect));
  if (result._tag === "Failure") {
    throw result.failure;
  }
  return result.success;
}
