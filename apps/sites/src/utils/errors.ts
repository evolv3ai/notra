export class StateUnavailableError extends Error {
  readonly name = "StateUnavailableError";
}

export function isStateUnavailable(error: unknown): boolean {
  return error instanceof StateUnavailableError || error instanceof SyntaxError;
}
