import { formatBrandGuidelineSourceInstructions } from "@notra/ai/utils/brand-guideline-source";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { brandGuidelines } from "@notra/db/schema";
import { eq } from "drizzle-orm";

/**
 * Prompt block for the brand voice's uploaded guideline PDF, or "" when there
 * is none. Never throws: a failed read must not abort content generation.
 */
export async function loadBrandGuidelineSourceInstructions(
  brandSettingsId: string | null | undefined
) {
  if (!brandSettingsId) {
    return "";
  }

  try {
    const row = await db.query.brandGuidelines.findFirst({
      where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
      columns: { sourcePdfText: true },
    });
    return formatBrandGuidelineSourceInstructions(row?.sourcePdfText);
  } catch (error) {
    logError("Failed to load brand guideline source", error, {
      brandSettingsId,
    });
    return "";
  }
}
