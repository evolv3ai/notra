import {
  type ConsentRouteHandler,
  createConsentRoute,
} from "c15t/tanstack-start/api";

interface ConsentRouteContext {
  params: Promise<{ all?: string[] }>;
}

const handlers = createConsentRoute({ proxy: true });

function withSplat(handler: ConsentRouteHandler) {
  return async (request: Request, { params }: ConsentRouteContext) => {
    const { all } = await params;
    return handler({ request, params: { _splat: all?.join("/") } });
  };
}

export const GET = withSplat(handlers.GET);
export const POST = withSplat(handlers.POST);
export const PATCH = withSplat(handlers.PATCH);
export const PUT = withSplat(handlers.PUT);
export const DELETE = withSplat(handlers.DELETE);
export const OPTIONS = withSplat(handlers.OPTIONS);
