import { serveFetch } from "./http-server";
import type {
  EmulatedRequest,
  EmulatorServer,
  Route,
  RouteParams,
} from "./types";

export class EmulatorError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function compile(path: string) {
  const names: string[] = [];
  const pattern = path
    .split("/")
    .map((segment) => {
      const param = segment.match(/^:(\w+)(\+)?$/);
      if (!param) {
        return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      names.push(param[1] ?? "");
      return param[2] ? "(.+)" : "([^/]+)";
    })
    .join("/");
  // S3 clients address a bucket as `/bucket/`; a trailing slash matches too.
  return { names, regex: new RegExp(`^${pattern}/?$`) };
}

// One emulated external service: a loopback HTTP server with a route table.
// Every request lands in the journal; a request no route matches answers 501
// and is marked unhandled, so the suite notices when product code starts
// calling an endpoint nobody emulated yet.
export async function startEmulator(
  name: string,
  routes: Route[],
  options: { fallback?: (request: Request) => Promise<Response> } = {}
): Promise<EmulatorServer & { route(path: string): string | null }> {
  const table = routes.map((route) => ({ ...route, ...compile(route.path) }));
  const requests: EmulatedRequest[] = [];
  const routeOf = (method: string, pathname: string) => {
    for (const route of table) {
      if (route.method !== method && route.method !== "*") {
        continue;
      }
      const match = pathname.match(route.regex);
      if (match) {
        const params: RouteParams = {};
        route.names.forEach((key, index) => {
          params[key] = decodeURIComponent(match[index + 1] ?? "");
        });
        return { route, params };
      }
    }
    return null;
  };
  const server = await serveFetch(async (request) => {
    const started = performance.now();
    const url = new URL(request.url);
    const matched = routeOf(request.method, url.pathname);
    let response: Response;
    let handled = Boolean(matched);
    try {
      if (matched) {
        response = await matched.route.handle(request, matched.params, url);
      } else if (options.fallback) {
        response = await options.fallback(request);
        handled = response.status !== 501;
      } else {
        response = Response.json(
          {
            message: `${name} emulator has no route for ${request.method} ${url.pathname}`,
          },
          { status: 501 }
        );
      }
    } catch (error) {
      const status = error instanceof EmulatorError ? error.status : 500;
      response = Response.json({ message: String(error) }, { status });
    }
    requests.push({
      service: name,
      method: request.method,
      path: matched
        ? `${matched.route.method === "*" ? request.method : matched.route.method} ${matched.route.path}`
        : `${request.method} ${url.pathname}`,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      handled,
    });
    return response;
  });
  return {
    name,
    url: `http://127.0.0.1:${server.port}`,
    requests,
    route: (path: string) => routeOf("GET", path)?.route.path ?? null,
    close: server.stop,
  };
}
