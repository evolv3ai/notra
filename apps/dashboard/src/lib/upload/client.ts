import {
  ALLOWED_CHAT_MIME_TYPES,
  type AllowedChatMimeType,
  SVG_MIME_TYPE,
} from "@notra/schemas/constants/dashboard/upload";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentMediaKind } from "@/types/content/media";
import type {
  DeleteChatUploadProps,
  UploadFileProps,
  UploadFileResponse,
  UploadPresignedResponse,
  UploadType,
} from "@/types/upload/client";
import { sha256File } from "@/utils/sha256-file";

async function getPresignedUrl(
  file: File,
  type: UploadType,
  sha256?: string
): Promise<UploadPresignedResponse> {
  if (type === "chat") {
    return dashboardOrpc.upload.createPresignedUpload.call({
      type,
      fileType: file.type,
      fileSize: file.size,
      sha256,
    });
  }
  return dashboardOrpc.upload.createPresignedUpload.call({
    type,
    fileType: file.type,
    fileSize: file.size,
  });
}

async function uploadToR2(presignedUrl: string, file: File) {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status})`);
  }
}

async function uploadSvgThroughServer(
  file: File,
  type: "brand_asset" | "content"
): Promise<UploadFileResponse> {
  const svg = await file.text();
  const { key, publicUrl } = await dashboardOrpc.upload.uploadSvg.call({
    type,
    svg,
  });
  return { url: publicUrl, key };
}

export async function uploadFile({
  file,
  sha256: knownSha256,
  type,
}: UploadFileProps): Promise<UploadFileResponse> {
  if (
    (type === "content" || type === "brand_asset") &&
    file.type === SVG_MIME_TYPE
  ) {
    return uploadSvgThroughServer(file, type);
  }

  const isChatAttachment =
    type === "chat" &&
    ALLOWED_CHAT_MIME_TYPES.includes(file.type as AllowedChatMimeType);
  const sha256 = isChatAttachment
    ? (knownSha256 ?? (await sha256File(file)))
    : undefined;
  const { url, key, publicUrl, reused } = await getPresignedUrl(
    file,
    type,
    sha256
  );
  if (reused) {
    return { url: publicUrl, key };
  }
  if (!url) {
    throw new Error("Upload URL missing");
  }
  await uploadToR2(url, file);

  if (!isChatAttachment) {
    return { url: publicUrl, key };
  }

  const recording = dashboardOrpc.upload.recordChatAttachment.call({
    key,
    filename: file.name,
    mediaType: file.type as AllowedChatMimeType,
    sha256,
    size: file.size,
  });
  // Hashed uploads only exist under their content key once the server has
  // verified and published them, so a failed check fails the upload.
  if (sha256) {
    const published = await recording;
    return {
      url: published.publicUrl ?? publicUrl,
      key: published.key,
    };
  }
  await recording.catch((error: unknown) => {
    console.error("Failed to record chat attachment", { key, error });
  });
  return { url: publicUrl, key };
}

export async function uploadContentMedia(
  file: File,
  kind: ContentMediaKind,
  fallback: string
) {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);
  const response = await fetch("/api/uploads/content-image", {
    body,
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(fallback);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (
    !(
      payload &&
      typeof payload === "object" &&
      "url" in payload &&
      typeof payload.url === "string" &&
      "key" in payload &&
      typeof payload.key === "string"
    )
  ) {
    throw new Error(fallback);
  }
  return { key: payload.key, url: payload.url };
}

export async function deleteChatUpload({
  key,
}: DeleteChatUploadProps): Promise<void> {
  await dashboardOrpc.upload.deleteChatUpload.call({ key });
}
