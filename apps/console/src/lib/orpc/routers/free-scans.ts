import {
  freeScanAdminRunInputSchema,
  freeScanAdminRunResponseSchema,
} from "@notra/schemas/api/free-scan-admin";

import { FREE_SCAN_ADMIN_PATH } from "@/constants/free-scans";
import { assertAdmin } from "@/lib/auth/admin";
import { callDashboard } from "@/lib/dashboard";
import {
  listFreeScanClaims,
  saveFreeScanClaim,
} from "@/lib/free-scans/queries";
import { baseProcedure } from "@/lib/orpc/base";
import { saveFreeScanClaimInputSchema } from "@/schemas/free-scans";

import { conflict, internalServerError, notFound } from "../utils/errors";

export const freeScansRouter = {
  list: baseProcedure.handler(async ({ context }) => {
    await assertAdmin({ headers: context.headers });
    return listFreeScanClaims();
  }),
  save: baseProcedure
    .input(saveFreeScanClaimInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      const result = await saveFreeScanClaim(input);
      if (result === "organization_not_found") {
        throw notFound("Organization not found");
      }
      if (result === "claim_active") {
        throw conflict(
          "This free scan is running. Change the workspace after it finishes."
        );
      }
      return { ok: true };
    }),
  run: baseProcedure
    .input(freeScanAdminRunInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      const parsed = freeScanAdminRunResponseSchema.safeParse(
        await callDashboard(FREE_SCAN_ADMIN_PATH, input)
      );
      if (!parsed.success) {
        throw internalServerError(
          "The dashboard returned an invalid free scan response"
        );
      }
      return parsed.data;
    }),
};
