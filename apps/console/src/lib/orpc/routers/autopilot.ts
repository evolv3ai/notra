import {
  autopilotAdminRunsInputSchema,
  autopilotAdminRunsResponseSchema,
  autopilotAdminTraceInputSchema,
  autopilotAdminTraceResponseSchema,
} from "@notra/schemas/api/autopilot-admin";

import { assertAdmin } from "@/lib/auth/admin";
import { callAutopilotAdmin } from "@/lib/autopilot/dashboard";
import { baseProcedure } from "@/lib/orpc/base";

export const autopilotRouter = {
  runs: baseProcedure
    .input(autopilotAdminRunsInputSchema.omit({ action: true }))
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return callAutopilotAdmin(
        { ...input, action: "runs" },
        autopilotAdminRunsResponseSchema
      );
    }),
  trace: baseProcedure
    .input(autopilotAdminTraceInputSchema.omit({ action: true }))
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return callAutopilotAdmin(
        { ...input, action: "trace" },
        autopilotAdminTraceResponseSchema
      );
    }),
};
