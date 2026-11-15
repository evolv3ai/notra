"use server";

import { db } from "@notra/db/drizzle";
import { geoProspectReports, organizations } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { GEO_SHARE_TOKEN_LENGTH } from "@/constants/geo-report";
import { hasAdminRole } from "@/lib/auth/role";
import { OrganizationActionError } from "@/lib/organizations/errors";
import { requireMembership, requireSession } from "@/lib/organizations/guards";
import { runOrganizationAction } from "@/lib/organizations/run-action";
import { validateActionInput } from "@/lib/organizations/validate-input";
import {
  geoDeleteReportInputSchema,
  geoSaveReportInputSchema,
} from "@/schemas/geo-report";
import type { GeoReport, GeoSavedReport } from "@/types/geo-report";
import type { ActionResult } from "@/types/organization";

/** Admin session + membership in the workspace behind `slug`. */
const requireGeoAccess = Effect.fn("geoReports.requireGeoAccess")(function* (
  slug: string
) {
  const session = yield* requireSession();
  if (!hasAdminRole(session.user.role)) {
    return yield* Effect.fail(
      new OrganizationActionError({
        message: "You do not have permission to manage GEO reports",
      })
    );
  }
  const organization = yield* Effect.tryPromise({
    try: () =>
      db.query.organizations.findFirst({
        columns: { id: true },
        where: eq(organizations.slug, slug),
      }),
    catch: (cause) =>
      new OrganizationActionError({
        message: "Failed to load workspace",
        cause,
      }),
  });
  if (!organization) {
    return yield* Effect.fail(
      new OrganizationActionError({ message: "Workspace not found" })
    );
  }
  yield* requireMembership(session, organization.id);
  return { session, organizationId: organization.id };
});

function denormalize(report: GeoReport) {
  return {
    status: report.status,
    companyName: report.company.name.trim(),
    companyDomain: report.company.domain.trim(),
    visibilityScore:
      report.prompts.length > 0
        ? Math.round(report.summary.visibilityScore)
        : null,
    modelCount: report.modelIds.length,
    promptCount: report.prompts.length,
  };
}

export async function saveGeoReportAction(
  rawInput: unknown
): Promise<ActionResult<GeoSavedReport>> {
  return runOrganizationAction(
    Effect.gen(function* () {
      const input = yield* validateActionInput(
        geoSaveReportInputSchema,
        rawInput
      );
      const { session, organizationId } = yield* requireGeoAccess(input.slug);
      const scannedAt = input.scannedAt ? new Date(input.scannedAt) : null;

      if (input.id === null) {
        const id = nanoid();
        const shareToken = nanoid(GEO_SHARE_TOKEN_LENGTH);
        yield* Effect.tryPromise({
          try: () =>
            db.insert(geoProspectReports).values({
              id,
              organizationId,
              createdByUserId: session.user.id,
              shareToken,
              report: { ...input.report, id },
              lastScannedAt: scannedAt,
              ...denormalize(input.report),
            }),
          catch: (cause) =>
            new OrganizationActionError({
              message: "Failed to create report",
              cause,
            }),
        });
        return { id, shareToken };
      }

      const id = input.id;
      const updated = yield* Effect.tryPromise({
        try: () =>
          db
            .update(geoProspectReports)
            .set({
              report: { ...input.report, id },
              ...denormalize(input.report),
              ...(scannedAt ? { lastScannedAt: scannedAt } : {}),
            })
            .where(
              and(
                eq(geoProspectReports.id, id),
                eq(geoProspectReports.organizationId, organizationId)
              )
            )
            .returning({ shareToken: geoProspectReports.shareToken }),
        catch: (cause) =>
          new OrganizationActionError({
            message: "Failed to save report",
            cause,
          }),
      });
      const row = updated[0];
      if (!row) {
        return yield* Effect.fail(
          new OrganizationActionError({ message: "Report not found" })
        );
      }
      return { id, shareToken: row.shareToken };
    })
  );
}

export async function deleteGeoReportAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  return runOrganizationAction(
    Effect.gen(function* () {
      const input = yield* validateActionInput(
        geoDeleteReportInputSchema,
        rawInput
      );
      const { organizationId } = yield* requireGeoAccess(input.slug);
      const deleted = yield* Effect.tryPromise({
        try: () =>
          db
            .delete(geoProspectReports)
            .where(
              and(
                eq(geoProspectReports.id, input.id),
                eq(geoProspectReports.organizationId, organizationId)
              )
            )
            .returning({ id: geoProspectReports.id }),
        catch: (cause) =>
          new OrganizationActionError({
            message: "Failed to delete report",
            cause,
          }),
      });
      const row = deleted[0];
      if (!row) {
        return yield* Effect.fail(
          new OrganizationActionError({ message: "Report not found" })
        );
      }
      return { id: row.id };
    })
  );
}
