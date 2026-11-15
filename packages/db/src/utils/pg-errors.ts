/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION_CODE = "23505";
/** Drizzle nests one wrapper (DrizzleQueryError); leave room for app wrappers. */
const MAX_CAUSE_DEPTH = 6;

/**
 * True when `error`, or any error in its `.cause` chain, is a Postgres unique
 * violation. Drizzle wraps driver errors in `DrizzleQueryError` with the pg
 * error as `.cause`, so the chain has to be walked.
 *
 * With `constraint`, the violated index/constraint name must match exactly.
 * Both drivers in use expose it as `constraint`: node-postgres
 * (`DatabaseError`) and @neondatabase/serverless (`NeonDbError`). No message
 * matching, since both drivers always populate the field for 23505.
 */
export function isPgUniqueViolation(
  error: unknown,
  constraint?: string
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) {
      return false;
    }
    if (
      "code" in current &&
      current.code === UNIQUE_VIOLATION_CODE &&
      (constraint === undefined ||
        ("constraint" in current && current.constraint === constraint))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
