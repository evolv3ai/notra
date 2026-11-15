export interface EmulatedRequest {
  service: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  /** False when no route matched: the code called something unemulated. */
  handled: boolean;
}

export interface EmulatorServer {
  name: string;
  url: string;
  requests: EmulatedRequest[];
  close(): Promise<void>;
}

export type RouteParams = Record<string, string>;

export type RouteHandler = (
  request: Request,
  params: RouteParams,
  url: URL
) => Promise<Response> | Response;

export interface Route {
  method: string;
  /** `/v2/box/:id/exec`; a trailing `:name+` matches the rest of the path. */
  path: string;
  handle: RouteHandler;
}

export interface EmulatorSummary {
  service: string;
  requests: number;
  unhandled: string[];
  /** `METHOD /path/with/:params` → count, in route order. */
  routes: Record<string, number>;
}
