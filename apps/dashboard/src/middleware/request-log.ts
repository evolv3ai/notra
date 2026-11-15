import { useLogger as getRequestLogger, withEvlog } from "@notra/ai/evlog";
import { createMiddleware } from "@tanstack/react-start";

type RequestLogger = ReturnType<
  typeof getRequestLogger<Record<string, unknown>>
>;

export const requestLogMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const run = (log: RequestLogger) => next({ context: { log } });
    let result: Awaited<ReturnType<typeof run>> | undefined;
    const response = await withEvlog(async (_request: Request) => {
      result = await run(getRequestLogger());
      return result.response;
    })(request);
    if (!result) {
      return response;
    }
    return { ...result, response };
  }
);
