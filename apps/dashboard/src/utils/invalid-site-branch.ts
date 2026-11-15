export function isInvalidSiteBranchError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (
    Reflect.get(error, "message") === "Branch not found" &&
    (["BAD_REQUEST", "NOT_FOUND"].includes(Reflect.get(error, "code")) ||
      Reflect.get(error, "status") === 404)
  );
}
