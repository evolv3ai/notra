import type { GenerateOgImageParams } from "@notra/ai/types/og-image";
import { fallbackOgTemplate } from "@notra/ai/utils/og-fallback";
import { generateBrandOgImage } from "@notra/ai/utils/og-image";
import { renderOgImage } from "@notra/ai/utils/og-render";
import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { eq } from "drizzle-orm";

/** Autopilot and the agent tool use the same researched, cached brand template. */
export async function renderPostHeroImage(params: GenerateOgImageParams) {
  // The shared designer owns its budget; let it finish last-good/plain rendering
  // after that budget expires instead of racing away a usable fallback.
  try {
    return await generateBrandOgImage(params);
  } catch (error) {
    if (
      params.brandIdentityId ||
      !(error instanceof Error) ||
      error.message !== "Brand identity not found in this organization"
    ) {
      throw error;
    }
    const organization = await db.query.organizations.findFirst({
      columns: { name: true },
      where: eq(organizations.id, params.organizationId),
    });
    if (!organization) {
      throw error;
    }
    const brand = {
      id: "",
      name: organization.name,
      websiteUrl: null,
      guideline: null,
      assets: [],
    };
    const fallback = await fallbackOgTemplate(brand);
    return {
      ...(await renderOgImage(fallback, params.title, brand)),
      brandIdentityId: "",
      templateSource: "fallback" as const,
      warnings: [
        "No brand identity is configured; using an organization-name fallback.",
      ],
    };
  }
}
