import type { OgBrandContext } from "@notra/ai/types/og-image";
import { db } from "@notra/db/drizzle";
import {
  brandGuidelineAssets,
  brandGuidelineColors,
  brandGuidelineFonts,
  brandGuidelineScreenshots,
  brandGuidelines,
  brandGuidelineTokens,
  brandSettings,
} from "@notra/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

export async function loadOgBrand(
  organizationId: string,
  brandIdentityId?: string
): Promise<OgBrandContext> {
  const identity = await db.query.brandSettings.findFirst({
    where: and(
      eq(brandSettings.organizationId, organizationId),
      ...(brandIdentityId ? [eq(brandSettings.id, brandIdentityId)] : [])
    ),
    orderBy: [desc(brandSettings.isDefault), desc(brandSettings.createdAt)],
  });
  if (!identity) {
    throw new Error("Brand identity not found in this organization");
  }
  const guideline = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, identity.id),
    with: {
      assets: {
        orderBy: [
          asc(brandGuidelineAssets.sortOrder),
          asc(brandGuidelineAssets.id),
        ],
      },
      colors: {
        orderBy: [
          asc(brandGuidelineColors.sortOrder),
          asc(brandGuidelineColors.id),
        ],
      },
      fonts: {
        orderBy: [
          asc(brandGuidelineFonts.sortOrder),
          asc(brandGuidelineFonts.id),
        ],
      },
      tokens: {
        orderBy: [
          asc(brandGuidelineTokens.sortOrder),
          asc(brandGuidelineTokens.id),
        ],
      },
      screenshots: {
        orderBy: [
          asc(brandGuidelineScreenshots.sortOrder),
          asc(brandGuidelineScreenshots.id),
        ],
      },
    },
  });
  return {
    id: identity.id,
    name: identity.companyName ?? identity.name,
    websiteUrl: identity.websiteUrl,
    guideline: guideline ?? null,
    assets:
      guideline?.assets.map((asset) => ({
        id: asset.id,
        url: asset.url,
        label: `${asset.kind} ${asset.variant} (${asset.width ?? "?"}x${asset.height ?? "?"})`,
      })) ?? [],
  };
}
