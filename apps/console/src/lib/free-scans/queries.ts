import "server-only";
import { db } from "@notra/db/drizzle";
import { freeScanClaims, organizations } from "@notra/db/schema";
import { asc, eq, isNotNull, isNull, or } from "drizzle-orm";

import type {
  FreeScanClaimRow,
  SaveFreeScanClaimInput,
  SaveFreeScanClaimResult,
} from "@/types/free-scans";

export async function listFreeScanClaims(): Promise<FreeScanClaimRow[]> {
  const rows = await db
    .select({
      domain: freeScanClaims.domain,
      promptLimit: freeScanClaims.promptLimit,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      claimedAt: freeScanClaims.claimedAt,
      revokedAt: freeScanClaims.revokedAt,
    })
    .from(freeScanClaims)
    .leftJoin(
      organizations,
      eq(organizations.id, freeScanClaims.organizationId)
    )
    .orderBy(asc(freeScanClaims.domain));
  return rows.map((row) => ({
    ...row,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }));
}

export async function saveFreeScanClaim(
  input: SaveFreeScanClaimInput
): Promise<SaveFreeScanClaimResult> {
  let organizationId: string | undefined;
  if (input.organizationSlug) {
    const organization = await db.query.organizations.findFirst({
      columns: { id: true },
      where: eq(organizations.slug, input.organizationSlug),
    });
    if (!organization) {
      return "organization_not_found";
    }
    organizationId = organization.id;
  }
  const [saved] = await db
    .insert(freeScanClaims)
    .values({
      domain: input.domain,
      promptLimit: input.promptLimit,
      organizationId,
    })
    .onConflictDoUpdate({
      target: freeScanClaims.domain,
      set: {
        promptLimit: input.promptLimit,
        ...(organizationId ? { organizationId } : {}),
      },
      ...(organizationId
        ? {
            setWhere: or(
              isNull(freeScanClaims.claimedAt),
              isNotNull(freeScanClaims.revokedAt),
              eq(freeScanClaims.organizationId, organizationId)
            ),
          }
        : {}),
    })
    .returning({ domain: freeScanClaims.domain });
  return saved ? "saved" : "claim_active";
}
