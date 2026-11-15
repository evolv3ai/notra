import { db } from "@notra/db/drizzle";
import { brandSettings } from "@notra/db/schema";
import { invalidateGeoIngestHostsCacheForBrand } from "@notra/geo-core/geo/ingest";
import { and, eq } from "drizzle-orm";

import type {
  BrandAnalysisStep,
  DefaultBrandSettingsData,
} from "@/types/brand-analysis";
import type {
  ProgressData,
  ProgressStatus,
} from "@/types/hooks/brand-analysis";

export function getStepFromCurrentStep(
  data: ProgressData
): BrandAnalysisStep | null {
  if (data.currentStep === 1) {
    return "scraping";
  }

  if (data.currentStep === 2) {
    return "extracting";
  }

  if (data.currentStep === 3) {
    return "saving";
  }

  return null;
}

export function getStepFromStatus(
  status: ProgressStatus
): BrandAnalysisStep | null {
  if (status === "scraping" || status === "extracting" || status === "saving") {
    return status;
  }

  return null;
}

export async function updateDefaultBrandSettings(
  organizationId: string,
  brandData: DefaultBrandSettingsData
) {
  const existing = await db.query.brandSettings.findFirst({
    where: and(
      eq(brandSettings.organizationId, organizationId),
      eq(brandSettings.isDefault, true)
    ),
  });

  if (existing) {
    await db
      .update(brandSettings)
      .set(brandData)
      .where(eq(brandSettings.id, existing.id));
    await invalidateGeoIngestHostsCacheForBrand(organizationId, existing.id);
    return;
  }

  await db.insert(brandSettings).values({
    id: crypto.randomUUID(),
    organizationId,
    name: "Default",
    isDefault: true,
    ...brandData,
  });
}
