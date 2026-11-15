import type { BrandReferenceSummary } from "@notra/ai/types/brand-references";
import type { brandReferences } from "@notra/db/schema";

type BrandReferenceRecord = typeof brandReferences.$inferSelect;

export function serializeBrandReference(
  reference: BrandReferenceRecord
): BrandReferenceSummary {
  return {
    id: reference.id,
    brandIdentityId: reference.brandSettingsId,
    type: reference.type,
    content: reference.content,
    note: reference.note,
    sourceCapturedAt: reference.sourceCapturedAt?.toISOString() ?? null,
    sourceUrl: reference.sourceUrl,
    applicableTo: reference.applicableTo,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
  };
}

/** Metadata flag on references that never charged the REFERENCES quota. */
const UNMETERED_REFERENCE_METADATA_KEY = "unmetered";

function asMetadataRecord(metadata: unknown): Record<string, unknown> | null {
  return typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : null;
}

export function isUnmeteredReference(metadata: unknown) {
  return (
    asMetadataRecord(metadata)?.[UNMETERED_REFERENCE_METADATA_KEY] === true
  );
}

/**
 * Server-owned billing flag: drops any caller-supplied `unmetered` value and
 * sets it only when the reference did not charge the REFERENCES quota, so
 * deleting it must not refund.
 */
export function withReferenceBillingFlag(
  metadata: unknown,
  { metered }: { metered: boolean }
): Record<string, unknown> | null {
  const record = asMetadataRecord(metadata);
  const { [UNMETERED_REFERENCE_METADATA_KEY]: _ignored, ...rest } =
    record ?? {};
  if (!metered) {
    return { ...rest, [UNMETERED_REFERENCE_METADATA_KEY]: true };
  }
  return record ? rest : null;
}
