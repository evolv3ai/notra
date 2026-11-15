import {
  brandGuidelineColors,
  brandGuidelines,
  brandSettings,
} from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import type { DbClient } from "../types/db";

export const brandColorColumns = {
  id: brandGuidelineColors.id,
  role: brandGuidelineColors.role,
  name: brandGuidelineColors.name,
  lightValue: brandGuidelineColors.lightValue,
  darkValue: brandGuidelineColors.darkValue,
  usage: brandGuidelineColors.usage,
};

export async function findBrandGuidelineId(
  db: DbClient,
  organizationId: string,
  brandIdentityId: string
) {
  const [row] = await db
    .select({ id: brandGuidelines.id })
    .from(brandGuidelines)
    .innerJoin(
      brandSettings,
      eq(brandSettings.id, brandGuidelines.brandSettingsId)
    )
    .where(
      and(
        eq(brandSettings.id, brandIdentityId),
        eq(brandSettings.organizationId, organizationId)
      )
    )
    .limit(1);

  return row?.id ?? null;
}

export function brandColorInGuideline(guidelineId: string, colorId: string) {
  return and(
    eq(brandGuidelineColors.id, colorId),
    eq(brandGuidelineColors.guidelineId, guidelineId)
  );
}
