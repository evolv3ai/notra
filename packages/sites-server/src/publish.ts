import {
  SITE_BUILD_LIMITS,
  SITE_R2_KEYS,
} from "@notra/sites-core/constants/sites";
import { SITE_IMAGE_UPLOAD_OUTPUT_PATH } from "@notra/sites-core/constants/uploads";
import type {
  SiteManifest,
  SiteManifestFile,
} from "@notra/sites-core/types/deployment";
import { sha256Hex } from "@notra/sites-core/utils/hash";
import { siteRedirectRules } from "@notra/sites-core/utils/redirects";
import { Clock, Effect } from "effect";

import { UPLOAD_CONCURRENCY } from "./constants/build";
import { JSON_CONTENT_TYPE } from "./constants/content-types";
import { r2PutEffect } from "./r2";
import type { PublishDeploymentFilesParams } from "./types/deployments";
import { mapWithConcurrencyEffect } from "./utils/concurrency";
import { contentTypeForPath } from "./utils/content-types";
import { gitBlobSha } from "./utils/image-type";
import { readTarGz } from "./utils/read-tar-gz";
import { runSitesEffect } from "./utils/run-sites-effect";

/** Uploads are named after their blob SHA; only trust names that match. */
function isContentAddressed(path: string, data: Uint8Array): boolean {
  const hash = SITE_IMAGE_UPLOAD_OUTPUT_PATH.exec(path)?.[1];
  return Boolean(hash && gitBlobSha(data).startsWith(hash));
}

export const publishDeploymentFilesEffect = Effect.fn(
  "Sites.publishDeploymentFiles"
)(function* (params: PublishDeploymentFilesParams) {
  const { site, deployment } = params;
  const files = readTarGz(params.archive, {
    maxFiles: SITE_BUILD_LIMITS.maxOutputFiles,
    maxBytes: SITE_BUILD_LIMITS.maxOutputBytes,
    maxFileBytes: SITE_BUILD_LIMITS.maxSingleFileBytes,
  });
  if (files.length === 0) {
    return yield* Effect.fail(new Error("The build produced no files"));
  }
  const manifestFiles = yield* mapWithConcurrencyEffect(
    files,
    UPLOAD_CONCURRENCY,
    (file) =>
      Effect.gen(function* () {
        const path = `/${file.path}`;
        const contentType = contentTypeForPath(path);
        yield* r2PutEffect(
          SITE_R2_KEYS.file(site.id, deployment.id, path),
          file.data,
          {
            contentType,
          }
        );
        return {
          path,
          size: file.data.byteLength,
          sha256: yield* Effect.tryPromise({
            try: () => sha256Hex(file.data),
            catch: (error) => error,
          }),
          contentType,
          ...(isContentAddressed(path, file.data) ? { immutable: true } : {}),
        } satisfies SiteManifestFile;
      })
  );
  const createdAt = yield* Clock.currentTimeMillis;
  const manifest: SiteManifest = {
    version: 1,
    siteId: site.id,
    deploymentId: deployment.id,
    commitSha: deployment.commitSha,
    toolchainVersion: params.toolchainVersion ?? "unknown",
    target: deployment.target,
    configHash: deployment.configHash,
    createdAt: new Date(createdAt).toISOString(),
    totalBytes: manifestFiles.reduce((sum, file) => sum + file.size, 0),
    files: manifestFiles.sort((a, b) => a.path.localeCompare(b.path)),
    redirects: siteRedirectRules(params.result.redirects),
    contentSecurityPolicy: params.result.contentSecurityPolicy ?? undefined,
    analyticsConsent: params.result.analyticsConsent || undefined,
    consentStorageKey: params.result.consentStorageKey,
    faviconHost: params.result.faviconHost,
  };
  yield* r2PutEffect(
    SITE_R2_KEYS.manifest(site.id, deployment.id),
    JSON.stringify(manifest),
    { contentType: JSON_CONTENT_TYPE }
  );
  return manifest;
});

export function publishDeploymentFiles(
  params: PublishDeploymentFilesParams
): Promise<SiteManifest> {
  return runSitesEffect(publishDeploymentFilesEffect(params));
}
