import {
  ALLOWED_CHAT_MIME_TYPES,
  ALLOWED_OPENAI_CHAT_MIME_TYPES,
} from "@notra/schemas/constants/dashboard/upload";
import { IMAGE_MIME_EXTENSIONS } from "@notra/sites-core/constants/uploads";

const MIME_EXTENSION_MAP: Record<string, string> = {
  ...IMAGE_MIME_EXTENSIONS,
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function getFileExtension(fileType: string) {
  const normalizedMimeType = fileType.split(";")[0]?.trim().toLowerCase();
  if (!normalizedMimeType) {
    return "bin";
  }

  return MIME_EXTENSION_MAP[normalizedMimeType] ?? "bin";
}

export function getAllowedChatMimeTypes(model?: string) {
  return model === "openai/gpt-5.4"
    ? ALLOWED_OPENAI_CHAT_MIME_TYPES
    : ALLOWED_CHAT_MIME_TYPES;
}

export function isAllowedChatMimeType(fileType: string, model?: string) {
  return (getAllowedChatMimeTypes(model) as readonly string[]).includes(
    fileType
  );
}

export function isImageMimeType(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}

export function isPdfMimeType(mediaType: string): boolean {
  return mediaType === "application/pdf";
}

export function isTextMimeType(mediaType: string): boolean {
  return mediaType === "text/plain" || mediaType === "text/markdown";
}
