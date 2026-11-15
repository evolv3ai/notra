// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

export const POST_TITLE_MAX_LENGTH = 120;
export const POST_MARKDOWN_MAX_LENGTH = 100_000;

export const BRAND_NAME_MAX_LENGTH = 120;
export const BRAND_COMPANY_NAME_MAX_LENGTH = 200;
export const BRAND_COMPANY_DESCRIPTION_MIN_LENGTH = 10;
export const BRAND_COMPANY_DESCRIPTION_MAX_LENGTH = 4000;
export const BRAND_CUSTOM_TONE_MAX_LENGTH = 1000;
export const BRAND_CUSTOM_INSTRUCTIONS_MAX_LENGTH = 4000;
export const BRAND_AUDIENCE_MIN_LENGTH = 10;
export const BRAND_AUDIENCE_MAX_LENGTH = 1000;

export const postTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(POST_TITLE_MAX_LENGTH);

export const brandNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(BRAND_NAME_MAX_LENGTH);

export const brandCompanyNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(BRAND_COMPANY_NAME_MAX_LENGTH);

export const brandCompanyDescriptionSchema = z
  .string()
  .trim()
  .min(BRAND_COMPANY_DESCRIPTION_MIN_LENGTH)
  .max(BRAND_COMPANY_DESCRIPTION_MAX_LENGTH);

export const brandCustomToneSchema = z
  .string()
  .trim()
  .max(BRAND_CUSTOM_TONE_MAX_LENGTH);

export const brandCustomInstructionsSchema = z
  .string()
  .trim()
  .max(BRAND_CUSTOM_INSTRUCTIONS_MAX_LENGTH);

export const brandAudienceSchema = z
  .string()
  .trim()
  .min(BRAND_AUDIENCE_MIN_LENGTH)
  .max(BRAND_AUDIENCE_MAX_LENGTH);
