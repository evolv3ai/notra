import { randomUUID } from "node:crypto";

import { withReferenceBillingFlag } from "@notra/ai/utils/brand-references";
import { db } from "@notra/db/drizzle";
import { brandReferences, brandSettings } from "@notra/db/schema";
import { canonicalizeReferenceSourceUrl } from "@notra/db/utils/reference-source-url";
import { desc, eq } from "drizzle-orm";

import { REFERENCE_INSERT_BATCH_SIZE } from "../constants/references";
import type { ReferenceInput } from "../types/references";

function referenceKey(reference: Pick<ReferenceInput, "content" | "type">) {
  return `${reference.type}\u0000${reference.content}`;
}

function buildReferenceMetadata(reference: ReferenceInput) {
  const metadata: Record<string, unknown> = { source: "onboarding-agent" };
  if (reference.authorName) {
    metadata.authorName = reference.authorName;
  }
  if (reference.authorHandle) {
    metadata.authorHandle = reference.authorHandle;
  }
  if (reference.title) {
    metadata.title = reference.title;
  }
  if (reference.publishedAt) {
    metadata.createdAt = reference.publishedAt;
  }
  if (reference.likes != null) {
    metadata.likes = reference.likes;
  }
  if (reference.retweets != null) {
    metadata.retweets = reference.retweets;
  }
  if (reference.replies != null) {
    metadata.replies = reference.replies;
  }
  return metadata;
}

function getCanonicalSourceUrl(sourceUrl: string | null | undefined) {
  if (!sourceUrl) {
    return null;
  }
  try {
    return canonicalizeReferenceSourceUrl(sourceUrl);
  } catch {
    return sourceUrl.trim();
  }
}

export async function addBrandReferences(
  organizationId: string,
  references: ReferenceInput[]
) {
  return await db.transaction(async (tx) => {
    const [settings] = await tx
      .select({ id: brandSettings.id })
      .from(brandSettings)
      .where(eq(brandSettings.organizationId, organizationId))
      .orderBy(desc(brandSettings.isDefault))
      .limit(1)
      .for("update");
    if (!settings) {
      throw new Error(
        "No brand settings exist for this organization; cannot add references"
      );
    }

    const existing = await tx
      .select({
        content: brandReferences.content,
        sourceUrl: brandReferences.sourceUrl,
        type: brandReferences.type,
      })
      .from(brandReferences)
      .where(eq(brandReferences.brandSettingsId, settings.id));
    const existingKeys = new Set(existing.map(referenceKey));
    const existingSourceUrls = new Set(
      existing.flatMap((reference) => {
        const sourceUrl = getCanonicalSourceUrl(reference.sourceUrl);
        return sourceUrl ? [sourceUrl] : [];
      })
    );
    const uniqueReferences = new Map<string, ReferenceInput>();
    const uniqueSourceUrls = new Set<string>();
    for (const reference of references) {
      const key = referenceKey(reference);
      const sourceUrl = getCanonicalSourceUrl(reference.sourceUrl);
      if (
        existingKeys.has(key) ||
        uniqueReferences.has(key) ||
        (sourceUrl
          ? existingSourceUrls.has(sourceUrl) || uniqueSourceUrls.has(sourceUrl)
          : false)
      ) {
        continue;
      }
      uniqueReferences.set(key, {
        ...reference,
        sourceUrl: sourceUrl ?? undefined,
      });
      if (sourceUrl) {
        uniqueSourceUrls.add(sourceUrl);
      }
    }

    const values = [...uniqueReferences.values()].map((reference) => ({
      applicableTo: reference.applicableTo,
      brandSettingsId: settings.id,
      content: reference.content,
      id: randomUUID(),
      // Onboarding references never charge the REFERENCES quota.
      metadata: withReferenceBillingFlag(buildReferenceMetadata(reference), {
        metered: false,
      }),
      note: reference.note ?? null,
      sourceCapturedAt: reference.sourceCapturedAt
        ? new Date(reference.sourceCapturedAt)
        : null,
      sourceContentHash: reference.sourceContentHash ?? null,
      sourceSnapshotKey: reference.sourceSnapshotKey ?? null,
      sourceUrl: reference.sourceUrl ?? null,
      type: reference.type,
    }));
    const inserted: Pick<typeof brandReferences.$inferSelect, "id" | "type">[] =
      [];
    for (let i = 0; i < values.length; i += REFERENCE_INSERT_BATCH_SIZE) {
      const chunk = values.slice(i, i + REFERENCE_INSERT_BATCH_SIZE);
      const rows = await tx
        .insert(brandReferences)
        .values(chunk)
        .returning({ id: brandReferences.id, type: brandReferences.type });
      inserted.push(...rows);
    }

    return {
      brandSettingsId: settings.id,
      inserted,
      insertedCount: inserted.length,
      skippedCount: references.length - inserted.length,
    };
  });
}
