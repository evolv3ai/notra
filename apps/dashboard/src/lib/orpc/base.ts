import {
  getOperationalContext,
  runWithOperationalContext,
} from "@notra/ai/utils/operational-context";
import { isDemoMode } from "@notra/utils/demo-mode";
import { os } from "@orpc/server";

import {
  assertAuthenticated,
  assertOrganizationAccess,
} from "@/lib/auth/organization";
import type { ORPCContext } from "@/types/orpc/context";
import { runWithRpcRequestMemo } from "@/utils/rpc-request-scope";

export const baseProcedure = os
  .$context<ORPCContext>()
  .use(async ({ next, path }, input) => {
    if (!isDemoMode()) {
      return next();
    }
    const startedAt = performance.now();
    const logger = import("@/lib/demo/ui-actions");
    const result = await next();
    const durationMs = performance.now() - startedAt;
    const { logDemoUiAction } = await logger;
    logDemoUiAction({ path, input, output: result.output, durationMs });
    return result;
  })
  .use(({ next, context }) => {
    const parent = getOperationalContext();
    return runWithRpcRequestMemo(context.requestMemo, () =>
      parent
        ? runWithOperationalContext(
            { ...parent, organizationId: undefined },
            next
          )
        : next()
    );
  });

export const authorizedProcedure = baseProcedure.use(
  async ({ context, next }) => {
    const auth = await assertAuthenticated({ headers: context.headers });

    const operationalContext = getOperationalContext();
    if (operationalContext) {
      operationalContext.userId = auth.user.id;
    }
    return next({
      context: {
        ...context,
        session: auth.session,
        user: auth.user,
      },
    });
  }
);

/** Use after `.input()` so `organizationId` is already validated. */
export const withOrganizationAccess = os.$context<ORPCContext>().middleware(
  async ({ context, next }, input: { organizationId: string }) =>
    await next({
      context: {
        auth: await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
          user: context.user ?? undefined,
        }),
      },
    })
);
