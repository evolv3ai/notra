import { createHash } from "node:crypto";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@notra/db/drizzle";
import { chatAttachments, members } from "@notra/db/schema";
import {
  ALLOWED_CHAT_MIME_TYPES,
  type AllowedChatMimeType,
  MAX_CHAT_FILE_SIZE,
} from "@notra/schemas/constants/dashboard/upload";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  CHAT_CONTENT_KEY_PREFIX,
  CHAT_CONTENT_KEY_RE,
  CHAT_STAGING_KEY_PREFIX,
  CHAT_STAGING_KEY_RE,
} from "@/constants/attachments";
import { GITHUB_CONTENT_MAX_SINGLE_ASSET_BYTES } from "@/constants/github";
import { assertAuthenticated } from "@/lib/auth/organization";
import { getTranslations } from "@/lib/i18n/server";
import type {
  UploadPresignedResponse,
  UploadType,
} from "@/types/upload/client";
import { compressContentImage } from "@/utils/compress-content-image";
import { contentImageKeyBelongsToOrganization } from "@/utils/content-image-key";
import { contentImageCompressedTooLargeMessage } from "@/utils/content-image-size";
import { recordAuthorizedOrganization } from "@/utils/rpc-telemetry";
import { validateContentVideo } from "@/utils/validate-content-video";

import { readContentImage, saveContentImage } from "./content-image-store";
import { getFileExtension } from "./mime";
import { getR2Config } from "./r2";
import { validateUpload } from "./validate";

const TRAILING_SLASH_REGEX = /\/$/;

interface ResolvedUploadTarget {
  organizationId: string | null | undefined;
  bucketName: string;
  fileSize: number;
  fileType: string;
  key: string;
  publicUrl: string;
}

async function assertUploadAccess({
  headers,
  type,
}: {
  headers: Headers;
  type: UploadType;
}) {
  const { session, user } = await assertAuthenticated({ headers });
  const organizationId = session.activeOrganizationId;

  const requiresOrganization =
    type === "logo" ||
    type === "brand_asset" ||
    type === "brand_guideline_pdf" ||
    type === "content" ||
    type === "chat";

  if (requiresOrganization && !organizationId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: (await getTranslations("common.labels"))("noActiveOrganization"),
    });
  }

  if (requiresOrganization && organizationId) {
    const membership = await db.query.members.findFirst({
      where: and(
        eq(members.userId, user.id),
        eq(members.organizationId, organizationId)
      ),
      columns: { id: true },
    });

    if (!membership) {
      throw new ORPCError("FORBIDDEN", {
        message: (await getTranslations("errors.upload"))(
          "noOrganizationAccess"
        ),
      });
    }
    recordAuthorizedOrganization(headers, organizationId, user.id);
  }

  return {
    organizationId,
    userId: user.id,
  };
}

async function resolveUploadTarget({
  fileSize,
  fileType,
  headers,
  sha256,
  type,
}: {
  fileSize: number;
  fileType: string;
  headers: Headers;
  sha256?: string;
  type: UploadType;
}): Promise<ResolvedUploadTarget> {
  const { organizationId, userId } = await assertUploadAccess({
    headers,
    type,
  });

  await validateUpload({
    fileSize,
    fileType,
    type,
  });

  const id = nanoid();
  const extension = getFileExtension(fileType);

  let key: string;

  switch (type) {
    case "avatar":
      key = `user/${userId}/avatar/${id}.${extension}`;
      break;
    case "logo":
      key = `organization/${organizationId}/logo/${id}.${extension}`;
      break;
    case "brand_asset":
      key = `organization/${organizationId}/brand-assets/${id}.${extension}`;
      break;
    case "brand_guideline_pdf":
      key = `organization/${organizationId}/brand-guidelines/${id}.${extension}`;
      break;
    case "content":
      key = `organization/${organizationId}/content/${id}.${extension}`;
      break;
    case "chat":
      // Hashed uploads land on a one-off staging key; only the server writes
      // the shared content key, so no presigned URL can ever overwrite it.
      key = sha256
        ? `organization/${organizationId}/chat/${CHAT_STAGING_KEY_PREFIX}${id}.${extension}`
        : `organization/${organizationId}/chat/${id}.${extension}`;
      break;
    default:
      throw new ORPCError("BAD_REQUEST", {
        message: (await getTranslations("errors.upload"))("fileTypeNotAllowed"),
      });
  }

  const { bucketName, publicUrl } = getR2Config();
  const normalizedPublicUrl = publicUrl.replace(TRAILING_SLASH_REGEX, "");

  return {
    bucketName,
    fileSize,
    fileType,
    key,
    organizationId,
    publicUrl: `${normalizedPublicUrl}/${key}`,
  };
}

export async function createPresignedUpload({
  fileSize,
  fileType,
  headers,
  sha256,
  type,
}: {
  fileSize: number;
  fileType: string;
  headers: Headers;
  sha256?: string;
  type: UploadType;
}): Promise<UploadPresignedResponse> {
  const target = await resolveUploadTarget({
    fileSize,
    fileType,
    headers,
    sha256,
    type,
  });

  // A recorded row means the server already hashed these exact bytes, so the
  // same file can point at the existing object instead of a second upload.
  if (sha256 && target.organizationId) {
    const contentKey = chatContentKey(target.key, sha256);
    const existing = await db.query.chatAttachments.findFirst({
      columns: { id: true },
      where: and(
        eq(chatAttachments.organizationId, target.organizationId),
        eq(chatAttachments.key, contentKey)
      ),
    });
    if (existing) {
      return {
        key: contentKey,
        publicUrl: target.publicUrl.replace(target.key, contentKey),
        reused: true,
      };
    }
  }
  const { client: r2Client } = getR2Config();
  const url = await getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: target.bucketName,
      Key: target.key,
      ContentLength: target.fileSize,
      ContentType: target.fileType,
    }),
    { expiresIn: 3600 }
  );

  return {
    key: target.key,
    publicUrl: target.publicUrl,
    url,
  };
}

async function requireUploadOrganization(headers: Headers, type: UploadType) {
  const { organizationId, userId } = await assertUploadAccess({
    headers,
    type,
  });
  if (!organizationId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: (await getTranslations("common.labels"))("noActiveOrganization"),
    });
  }
  return { organizationId, userId };
}

async function requireOwnChatUploadKey(headers: Headers, key: string) {
  const access = await requireUploadOrganization(headers, "chat");
  if (!key.startsWith(`organization/${access.organizationId}/chat/`)) {
    throw new ORPCError("FORBIDDEN", {
      message: (await getTranslations("errors.upload"))("noOrganizationAccess"),
    });
  }
  return access;
}

export async function deleteChatUpload({
  key,
  headers,
}: {
  key: string;
  headers: Headers;
}) {
  const { organizationId } = await requireOwnChatUploadKey(headers, key);

  // Content-addressed uploads are shared by sent messages and other open
  // drafts, so removing a chip keeps them; the attachments page deletes them.
  if (CHAT_CONTENT_KEY_RE.test(key)) {
    return { success: true };
  }

  await db
    .delete(chatAttachments)
    .where(
      and(
        eq(chatAttachments.organizationId, organizationId),
        eq(chatAttachments.key, key)
      )
    );

  const { client: r2Client, bucketName } = getR2Config();
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );

  return { success: true };
}

function chatContentKey(stagingKey: string, sha256: string) {
  const extension = stagingKey.slice(stagingKey.lastIndexOf(".") + 1);
  const directory = stagingKey.slice(0, stagingKey.lastIndexOf("/") + 1);
  return `${directory}${CHAT_CONTENT_KEY_PREFIX}${sha256}.${extension}`;
}

async function objectExists(key: string) {
  const { client: r2Client, bucketName } = getR2Config();
  return r2Client
    .send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
    .then(() => true)
    .catch(() => false);
}

/**
 * Hashes the staged bytes and, when they match, publishes them under the
 * content key. Returns the key the attachment should use.
 */
async function publishStagedChatUpload(stagingKey: string, sha256: string) {
  const { client: r2Client, bucketName, publicUrl } = getR2Config();
  const removeStaging = () =>
    r2Client
      .send(new DeleteObjectCommand({ Bucket: bucketName, Key: stagingKey }))
      .catch(() => undefined);

  const verifiedETag = await verifiedObjectETag(stagingKey, sha256);
  if (!verifiedETag) {
    await removeStaging();
    throw new ORPCError("BAD_REQUEST", {
      message: (await getTranslations("errors.upload"))("contentMismatch"),
    });
  }

  const contentKey = chatContentKey(stagingKey, sha256);
  if (!(await objectExists(contentKey))) {
    const copied = await r2Client
      .send(
        new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${stagingKey}`,
          // The presigned PUT stays valid, so only copy the bytes just hashed.
          CopySourceIfMatch: verifiedETag,
          Key: contentKey,
        })
      )
      .then(() => true)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "PreconditionFailed") {
          return false;
        }
        throw error;
      });
    if (!copied) {
      await removeStaging();
      throw new ORPCError("BAD_REQUEST", {
        message: (await getTranslations("errors.upload"))("contentMismatch"),
      });
    }
  }
  await removeStaging();
  return {
    key: contentKey,
    publicUrl: `${publicUrl.replace(TRAILING_SLASH_REGEX, "")}/${contentKey}`,
  };
}

/** Returns the object's ETag when its bytes hash to `sha256`, else null. */
async function verifiedObjectETag(key: string, sha256: string) {
  const { client: r2Client, bucketName } = getR2Config();
  const object = await r2Client
    .send(new GetObjectCommand({ Bucket: bucketName, Key: key }))
    .catch(() => null);
  const bytes = await object?.Body?.transformToByteArray();
  if (!(bytes && object?.ETag) || bytes.byteLength > MAX_CHAT_FILE_SIZE) {
    return null;
  }
  return createHash("sha256").update(bytes).digest("hex") === sha256
    ? object.ETag
    : null;
}

export async function recordChatAttachment({
  key: uploadedKey,
  filename,
  mediaType,
  sha256,
  size,
  headers,
}: {
  key: string;
  filename: string;
  mediaType: string;
  sha256?: string;
  size: number;
  headers: Headers;
}): Promise<{ success: true; key: string; publicUrl?: string }> {
  const { userId, organizationId } = await requireOwnChatUploadKey(
    headers,
    uploadedKey
  );

  if (!ALLOWED_CHAT_MIME_TYPES.includes(mediaType as AllowedChatMimeType)) {
    throw new ORPCError("BAD_REQUEST", {
      message: (await getTranslations("errors.upload"))("fileTypeNotAllowed"),
    });
  }

  if (size > MAX_CHAT_FILE_SIZE) {
    throw new ORPCError("BAD_REQUEST", {
      message: (await getTranslations("errors.upload"))("fileTooLarge", {
        maxMb: MAX_CHAT_FILE_SIZE / 1024 / 1024,
      }),
    });
  }

  if (CHAT_CONTENT_KEY_RE.test(uploadedKey)) {
    throw new ORPCError("BAD_REQUEST", {
      message: (await getTranslations("errors.upload"))("contentMismatch"),
    });
  }
  const published =
    sha256 && CHAT_STAGING_KEY_RE.test(uploadedKey)
      ? await publishStagedChatUpload(uploadedKey, sha256)
      : undefined;
  const key = published?.key ?? uploadedKey;

  await db
    .insert(chatAttachments)
    .values({
      id: nanoid(),
      organizationId,
      userId,
      key,
      filename,
      mediaType,
      size,
    })
    .onConflictDoNothing({ target: chatAttachments.key });

  return { success: true, key, publicUrl: published?.publicUrl };
}

export async function uploadContentImage({
  bytes,
  headers,
}: {
  bytes: Uint8Array;
  headers: Headers;
}) {
  const { organizationId } = await requireUploadOrganization(
    headers,
    "content"
  );
  let compressed: Awaited<ReturnType<typeof compressContentImage>>;
  try {
    compressed = await compressContentImage(bytes);
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        error instanceof Error ? error.message : "Could not read that image",
    });
  }

  if (compressed.bytes.byteLength > GITHUB_CONTENT_MAX_SINGLE_ASSET_BYTES) {
    throw new ORPCError("BAD_REQUEST", {
      message: contentImageCompressedTooLargeMessage(),
    });
  }

  return saveContentImage({
    bytes: compressed.bytes,
    mimeType: compressed.mimeType,
    organizationId,
  });
}

export async function uploadContentVideo({
  bytes,
  headers,
}: {
  bytes: Uint8Array;
  headers: Headers;
}) {
  const { organizationId } = await requireUploadOrganization(
    headers,
    "content"
  );
  let mimeType: ReturnType<typeof validateContentVideo>;
  try {
    mimeType = validateContentVideo(bytes);
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        error instanceof Error ? error.message : "Could not read that video",
    });
  }

  return saveContentImage({ bytes, mimeType, organizationId });
}

export async function readAuthorizedContentImage({
  headers,
  key,
}: {
  headers: Headers;
  key: string;
}) {
  const { organizationId } = await assertUploadAccess({
    headers,
    type: "content",
  });
  if (
    !(
      organizationId &&
      contentImageKeyBelongsToOrganization(key, organizationId)
    )
  ) {
    throw new ORPCError("NOT_FOUND", { message: "Image not found" });
  }

  const image = await readContentImage(
    key,
    GITHUB_CONTENT_MAX_SINGLE_ASSET_BYTES
  );
  if (!image) {
    throw new ORPCError("NOT_FOUND", { message: "Image not found" });
  }
  return image;
}
