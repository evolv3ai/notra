import { GITHUB_CONTENT_PATH_MAX_LENGTH } from "@notra/schemas/constants/dashboard/github";

import { GITHUB_CONTENT_MAX_ASSET_BYTES } from "@/constants/github";
import { SiteEntryFrontmatterError } from "@/lib/errors/site-entry";
import { getTranslations } from "@/lib/i18n/server";
import {
  prepareR2GitHubContentAssets,
  resolveGitHubImagePathTemplate,
} from "@/lib/integrations/github/content-assets";
import { prepareSiteEntryMetadata } from "@/lib/integrations/github/site-entry-metadata";
import { badRequest } from "@/lib/orpc/utils/errors";
import type { PreparedGitHubContent } from "@/types/integrations/github";
import type { PrepareSiteEntryFilesParams } from "@/types/integrations/site-github-publish";
import {
  buildSiteEntryMarkdown,
  resolveSiteImagePathTemplate,
  resolveSitePublicDirectory,
} from "@/utils/site-github-publish";

/** The entry file and images a post becomes on a Notra site. */
export async function prepareSiteEntryFiles(
  params: PrepareSiteEntryFilesParams
): Promise<PreparedGitHubContent> {
  const { post } = params;
  const imagePathTemplate = resolveGitHubImagePathTemplate(
    params.contentPath,
    params.imagePath?.trim()
      ? params.imagePath
      : resolveSiteImagePathTemplate(params.rootDirectory, params.contentType)
  );
  const publicDirectory = resolveSitePublicDirectory(params.rootDirectory);
  const [content, entryMetadata] = await Promise.all([
    prepareR2GitHubContentAssets({
      contentPath: params.contentPath,
      imagePathTemplate,
      markdown: post.markdown,
      organizationId: params.organizationId,
      publicDirectory,
      slug: params.slug,
    }),
    prepareSiteEntryMetadata(post, {
      contentPath: params.contentPath,
      contentType: params.contentType,
      imagePathTemplate,
      organizationId: params.organizationId,
      publicDirectory,
      slug: params.slug,
    }),
  ]);
  const assets = [
    ...new Map(
      [...content.assets, ...entryMetadata.assets].map((asset) => [
        asset.path,
        asset,
      ])
    ).values(),
  ];
  const tErrors = await getTranslations("errors.content");
  if (
    assets.some((asset) => asset.path.length > GITHUB_CONTENT_PATH_MAX_LENGTH)
  ) {
    throw badRequest(tErrors("imagePathTooLong"));
  }
  const assetBytes = assets.reduce(
    (total, asset) => total + asset.contents.byteLength,
    0
  );
  if (assetBytes > GITHUB_CONTENT_MAX_ASSET_BYTES) {
    throw badRequest(tErrors("assetsTooLarge"));
  }
  try {
    return {
      assets,
      markdown: buildSiteEntryMarkdown({
        author: params.siteEntry?.author,
        contentType: params.contentType,
        date: post.publishedAt ?? post.createdAt,
        existingMarkdown: params.siteEntry?.existingMarkdown,
        markdown: content.markdown,
        metadata: entryMetadata.metadata,
        title: post.title,
        updated: params.siteEntry?.isLive ? new Date() : null,
      }),
    };
  } catch (error) {
    if (error instanceof SiteEntryFrontmatterError) {
      throw badRequest(tErrors("invalidFrontmatter"));
    }
    throw error;
  }
}
