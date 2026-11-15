import "server-only";
import {
  GetObjectCommand,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { SITE_R2_KEYS } from "@/constants/site-r2";
import { siteServingStateSchema } from "@/schemas/sites";
import type { SiteServingState } from "@/types/sites";

let client: S3Client | undefined;

function getSitesR2(): { client: S3Client; bucket: string } | null {
  const accountId = process.env.SITES_R2_ACCOUNT_ID;
  const accessKeyId = process.env.SITES_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SITES_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.SITES_R2_BUCKET;
  if (!(accountId && accessKeyId && secretAccessKey && bucket)) {
    return null;
  }
  client ??= new S3Client({
    forcePathStyle: true,
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

async function readText(key: string): Promise<string | null> {
  const r2 = getSitesR2();
  if (!r2) {
    return null;
  }
  try {
    const object = await r2.client.send(
      new GetObjectCommand({ Bucket: r2.bucket, Key: key })
    );
    return (await object.Body?.transformToString()) ?? null;
  } catch (error) {
    if (
      error instanceof NoSuchKey ||
      (error instanceof S3ServiceException &&
        error.$metadata.httpStatusCode === 404)
    ) {
      return null;
    }
    throw error;
  }
}

/** Live build output; the runner appends to it while a build runs. */
export function readLiveBuildLog(
  siteId: string,
  deploymentId: string
): Promise<string | null> {
  return readText(SITE_R2_KEYS.buildLog(siteId, deploymentId));
}

/** Which deployments the edge currently serves for a site. */
export async function readServingState(
  siteId: string
): Promise<SiteServingState | null> {
  const text = await readText(SITE_R2_KEYS.state(siteId));
  if (!text) {
    return null;
  }
  try {
    const parsed = siteServingStateSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
