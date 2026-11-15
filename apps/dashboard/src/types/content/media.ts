import type { useTranslations } from "use-intl";

import type { CONTENT_MEDIA } from "@/constants/content-media";

export type ContentMediaKind = keyof typeof CONTENT_MEDIA;

export type ContentDropPoint = {
  key: string;
  offset: number;
  type: "element" | "text";
  beforeKey: string | null;
  afterKey: string | null;
  fallbackIndex: number;
};
export type UploadTranslator = ReturnType<
  typeof useTranslations<"content.editor.upload">
>;
