import { db } from "@notra/db/drizzle";
import { Effect, Exit } from "effect";
import type { Cause } from "effect";

import type { DbTransaction } from "../types/db";
import { GeoDatabaseError } from "./errors";

/** Thrown inside the transaction callback so drizzle rolls back, then unwrapped. */
class GeoTransactionRollback extends Error {
  readonly exitCause: Cause.Cause<unknown>;

  constructor(exitCause: Cause.Cause<unknown>) {
    super("GEO transaction rolled back");
    this.exitCause = exitCause;
  }
}

/**
 * Runs `run` inside one database transaction with the caller's services and
 * span. Any failure of `run` rolls the transaction back and keeps its typed
 * error (or defect); only the database itself yields `GeoDatabaseError`.
 *
 * Interrupting the caller stops the wait but not `run`: an in-flight query
 * cannot be cancelled, so stopping `run` midway would let drizzle roll back
 * while later statements still execute outside the transaction. The
 * transaction always runs to its own commit or rollback.
 */
export function geoTransaction<A, E, R>(
  label: string,
  run: (tx: DbTransaction) => Effect.Effect<A, E, R>
): Effect.Effect<A, E | GeoDatabaseError, R> {
  return Effect.flatMap(Effect.context<R>(), (context) => {
    const runInContext = Effect.runPromiseExitWith(context);
    return Effect.tryPromise({
      try: () =>
        db.transaction(async (tx): Promise<A> => {
          const exit = await runInContext(run(tx));
          if (Exit.isFailure(exit)) {
            throw new GeoTransactionRollback(exit.cause);
          }
          return exit.value;
        }),
      catch: (cause) =>
        cause instanceof GeoTransactionRollback
          ? cause
          : new GeoDatabaseError({ label, cause }),
    });
  }).pipe(
    Effect.catch((error): Effect.Effect<never, E | GeoDatabaseError> =>
      error instanceof GeoTransactionRollback
        ? Effect.failCause(error.exitCause as Cause.Cause<E>)
        : Effect.fail(error)
    )
  );
}
