import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { limitBrandGuidelineSourceText } from "@notra/ai/utils/brand-guideline-source";
import {
  isContextDevConfigured,
  parsePdfDocument,
} from "@notra/ai/utils/context-dev";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { brandGuidelines } from "@notra/db/schema";
import { MAX_BRAND_GUIDELINE_PDF_FILE_SIZE } from "@notra/schemas/constants/dashboard/upload";
import { and, eq } from "drizzle-orm";

import { BRAND_GUIDELINE_TRAILING_SLASH_REGEX } from "@/constants/brand-guidelines";
import {
  getBrandGuidelines,
  getGuidelineByBrandSettingsId,
} from "@/lib/brand-guidelines";
import { getTranslations } from "@/lib/i18n/server";
import { getR2Config } from "@/lib/upload/r2";
import type {
  AttachBrandGuidelineSourcePdfInput,
  BrandGuidelinePdfErrorKey,
} from "@/types/brand-guidelines";
import {
  hasGeneratedGuidelines,
  hasPdfSignature,
  isGuidelinePdfKeyForOrganization,
} from "@/utils/brand-guideline-pdf";

export class BrandGuidelineSourcePdfValidationError extends Error {
  override name = "BrandGuidelineSourcePdfValidationError";
}

async function guidelinePdfError(key: BrandGuidelinePdfErrorKey) {
  const t = await getTranslations("errors.brandGuidelinePdf");
  return new BrandGuidelineSourcePdfValidationError(t(key));
}

async function assertGuidelinePdfKey(organizationId: string, key: string) {
  if (!isGuidelinePdfKeyForOrganization(organizationId, key)) {
    throw await guidelinePdfError("invalidFile");
  }
}

async function deleteGuidelinePdfIfUnreferenced(key: string) {
  try {
    const referencing = await db.query.brandGuidelines.findFirst({
      where: eq(brandGuidelines.sourcePdfStorageKey, key),
      columns: { id: true },
    });
    if (referencing) {
      return;
    }
    const { bucketName, client } = getR2Config();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucketName, Key: key })
    );
  } catch (error) {
    logError("Failed to delete brand guideline PDF", error, { key });
  }
}

async function readGuidelinePdfText(key: string) {
  if (!isContextDevConfigured()) {
    throw await guidelinePdfError("unavailable");
  }

  const { bucketName, client } = getR2Config();
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  if (
    !object.Body ||
    (object.ContentLength ?? 0) > MAX_BRAND_GUIDELINE_PDF_FILE_SIZE
  ) {
    throw await guidelinePdfError("invalidFile");
  }
  const bytes = new Uint8Array(await object.Body.transformToByteArray());
  if (
    bytes.byteLength > MAX_BRAND_GUIDELINE_PDF_FILE_SIZE ||
    !hasPdfSignature(bytes)
  ) {
    throw await guidelinePdfError("invalidFile");
  }

  let markdown: string;
  try {
    markdown = await parsePdfDocument(bytes);
  } catch (error) {
    logError("Failed to parse brand guideline PDF", error, { key });
    throw await guidelinePdfError("readFailed");
  }

  const text = limitBrandGuidelineSourceText(markdown);
  if (!text) {
    throw await guidelinePdfError("noText");
  }
  return text;
}

export async function attachBrandGuidelineSourcePdf(
  input: AttachBrandGuidelineSourcePdfInput
) {
  await assertGuidelinePdfKey(input.organizationId, input.key);

  let replacedKey: string | null;
  try {
    const guideline = await getGuidelineByBrandSettingsId(
      input.brandSettingsId
    );
    if (!(guideline && hasGeneratedGuidelines(guideline))) {
      throw await guidelinePdfError("generateFirst");
    }

    const text = await readGuidelinePdfText(input.key);
    const now = new Date();

    replacedKey = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ sourcePdfStorageKey: brandGuidelines.sourcePdfStorageKey })
        .from(brandGuidelines)
        .where(eq(brandGuidelines.id, guideline.id))
        .for("update");
      await tx
        .update(brandGuidelines)
        .set({
          sourcePdfFilename: input.filename.trim(),
          sourcePdfStorageKey: input.key,
          sourcePdfText: text,
          sourcePdfUploadedAt: now,
          sourcePdfUrl: `${getR2Config().publicUrl.replace(BRAND_GUIDELINE_TRAILING_SLASH_REGEX, "")}/${input.key}`,
          updatedAt: now,
        })
        .where(eq(brandGuidelines.id, guideline.id));
      return locked?.sourcePdfStorageKey ?? null;
    });
  } catch (error) {
    await deleteGuidelinePdfIfUnreferenced(input.key);
    throw error;
  }

  if (replacedKey && replacedKey !== input.key) {
    await deleteGuidelinePdfIfUnreferenced(replacedKey);
  }

  return getBrandGuidelines(input.brandSettingsId);
}

export async function removeBrandGuidelineSourcePdf(brandSettingsId: string) {
  const existing = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
    columns: { id: true, sourcePdfStorageKey: true },
  });
  if (!existing?.sourcePdfStorageKey) {
    return getBrandGuidelines(brandSettingsId);
  }

  const cleared = await db
    .update(brandGuidelines)
    .set({
      sourcePdfFilename: null,
      sourcePdfStorageKey: null,
      sourcePdfText: null,
      sourcePdfUploadedAt: null,
      sourcePdfUrl: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(brandGuidelines.id, existing.id),
        eq(brandGuidelines.sourcePdfStorageKey, existing.sourcePdfStorageKey)
      )
    )
    .returning({ id: brandGuidelines.id });
  if (cleared.length > 0) {
    await deleteGuidelinePdfIfUnreferenced(existing.sourcePdfStorageKey);
  }
  return getBrandGuidelines(brandSettingsId);
}
