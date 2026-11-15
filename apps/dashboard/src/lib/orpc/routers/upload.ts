import {
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { fetchPublicUrl } from "@notra/ai/utils/public-fetch";
import { db } from "@notra/db/drizzle";
import { members } from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { SVG_MIME_TYPE } from "@notra/schemas/constants/dashboard/upload";
import {
  deleteChatUploadSchema,
  recordChatAttachmentSchema,
  uploadLogoFromUrlSchema,
  uploadSchema,
  uploadSvgSchema,
} from "@notra/schemas/dashboard/upload";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  COMPANY_LOGO_FETCH_TIMEOUT_MS,
  COMPANY_LOGO_SOURCE_HOSTS,
} from "@/constants/company-logo";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { getChatAttachmentSizeBucket } from "@/lib/analytics/studio-events";
import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure } from "@/lib/orpc/base";
import { getFileExtension } from "@/lib/upload/mime";
import { getR2Config } from "@/lib/upload/r2";
import { SvgSanitizationError, sanitizeSvg } from "@/lib/upload/sanitize-svg";
import {
  createPresignedUpload,
  deleteChatUpload,
  recordChatAttachment,
} from "@/lib/upload/server";
import { validateUpload } from "@/lib/upload/validate";
import { recordAuthorizedOrganization } from "@/utils/rpc-telemetry";

import {
  assertNotDemo,
  badRequest,
  forbidden,
  unauthorized,
} from "../utils/errors";

const TRAILING_SLASH_REGEX = /\/$/;

async function requireActiveOrganizationMember(context: {
  headers: Headers;
  session: { activeOrganizationId?: string | null } | null;
  user: { id: string };
}): Promise<string> {
  const orgId = context.session?.activeOrganizationId;

  if (!orgId) {
    throw unauthorized(
      (await getTranslations("common.labels"))("noActiveOrganization")
    );
  }

  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, context.user.id),
      eq(members.organizationId, orgId)
    ),
    columns: { id: true },
  });

  if (!membership) {
    const tErrors = await getTranslations("errors.upload");
    throw forbidden(tErrors("noOrganizationAccess"));
  }
  recordAuthorizedOrganization(context.headers, orgId, context.user.id);
  return orgId;
}

async function putPublicR2Object(
  object: Omit<PutObjectCommandInput, "Bucket"> & { Key: string }
) {
  const { client, bucketName, publicUrl } = getR2Config();
  await client.send(new PutObjectCommand({ Bucket: bucketName, ...object }));
  const baseUrl = publicUrl.replace(TRAILING_SLASH_REGEX, "");
  return { key: object.Key, publicUrl: `${baseUrl}/${object.Key}` };
}

export const uploadRouter = {
  createPresignedUpload: authorizedProcedure
    .input(uploadSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      return createPresignedUpload({
        fileSize: input.fileSize,
        fileType: input.fileType,
        headers: context.headers,
        sha256: input.type === "chat" ? input.sha256 : undefined,
        type: input.type,
      });
    }),
  deleteChatUpload: authorizedProcedure
    .input(deleteChatUploadSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      return deleteChatUpload({
        headers: context.headers,
        key: input.key,
      });
    }),
  recordChatAttachment: authorizedProcedure
    .input(recordChatAttachmentSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const result = await recordChatAttachment({
        headers: context.headers,
        key: input.key,
        filename: input.filename,
        mediaType: input.mediaType,
        sha256: input.sha256,
        size: input.size,
      });

      trackServerEvent({
        event: POSTHOG_EVENTS.CHAT_ATTACHMENT_UPLOADED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: context.session?.activeOrganizationId ?? null,
        properties: {
          mime: input.mediaType,
          size_bucket: getChatAttachmentSizeBucket(input.size),
        },
      });

      return result;
    }),
  logoFromUrl: authorizedProcedure
    .input(uploadLogoFromUrlSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const orgId = await requireActiveOrganizationMember(context);

      const sourceUrl = new URL(input.sourceUrl);
      const isAllowedSource =
        sourceUrl.protocol === "https:" &&
        COMPANY_LOGO_SOURCE_HOSTS.some((host) => host === sourceUrl.hostname);

      if (!isAllowedSource) {
        const tErrors = await getTranslations("errors.upload");
        throw badRequest(tErrors("logoSourceNotAllowed"));
      }

      // No redirects and public addresses only: the host allowlist above
      // would not hold for a redirect target.
      const response = await fetchPublicUrl(sourceUrl, undefined, {
        timeoutMs: COMPANY_LOGO_FETCH_TIMEOUT_MS,
      }).catch(() => null);

      if (!response?.ok) {
        const tErrors = await getTranslations("errors.upload");
        throw badRequest(tErrors("logoFetchFailed"));
      }

      const fileType =
        response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      const body = Buffer.from(await response.arrayBuffer());

      await validateUpload({
        type: "logo",
        fileType,
        fileSize: body.byteLength,
      });

      const id = nanoid();
      const key = `organization/${orgId}/logo/${id}.${getFileExtension(fileType)}`;
      return await putPublicR2Object({
        Key: key,
        Body: body,
        ContentType: fileType,
      });
    }),
  uploadSvg: authorizedProcedure
    .input(uploadSvgSchema)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const orgId = await requireActiveOrganizationMember(context);

      let sanitized: string;
      try {
        sanitized = await sanitizeSvg(input.svg);
      } catch (error) {
        if (error instanceof SvgSanitizationError) {
          const tErrors = await getTranslations("errors.upload");
          throw badRequest(tErrors("svgInvalid"));
        }
        throw error;
      }

      const id = nanoid();
      const key =
        input.type === "brand_asset"
          ? `organization/${orgId}/brand-assets/${id}.svg`
          : `organization/${orgId}/content/${id}.svg`;
      return await putPublicR2Object({
        Key: key,
        Body: sanitized,
        ContentType: SVG_MIME_TYPE,
        ContentDisposition:
          input.type === "brand_asset" ? "inline" : "attachment",
        CacheControl: "no-store",
      });
    }),
};
