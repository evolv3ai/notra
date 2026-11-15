import { expect, test } from "bun:test";

import { SITE_PLAN_LIMIT_MESSAGES } from "@notra/sites-server/constants/plan-limits";
import { SitePlanLimitError } from "@notra/sites-server/errors/sites";
import { ORPCError } from "@orpc/server";

import {
  bulkImportErrorMessage,
  toSitesOrpcError,
} from "@/lib/sites/orpc-errors";

test("a Free plan Sites limit answers 402 and names the limit for the upgrade UI", () => {
  for (const limit of ["sites", "domains", "branding"] as const) {
    const error = toSitesOrpcError(new SitePlanLimitError(limit));
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({
      code: "PAYMENT_REQUIRED",
      status: 402,
      message: SITE_PLAN_LIMIT_MESSAGES[limit],
      data: { limit },
    });
  }
});

test("a bulk import row rejected by the site limit shows the limit message", () => {
  expect(bulkImportErrorMessage(new SitePlanLimitError("sites"))).toBe(
    SITE_PLAN_LIMIT_MESSAGES.sites
  );
});
