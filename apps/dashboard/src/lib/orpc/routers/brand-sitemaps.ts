import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { voiceInputSchema } from "@notra/schemas/dashboard/brand";
import {
  createSitemapSchema,
  deleteSitemapSchema,
  listSitemapPagesSchema,
} from "@notra/schemas/dashboard/sitemap";

import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { getSitemapBrandIdentity } from "@/lib/sitemap/brand-identity";
import { getContextDevSitemap } from "@/lib/sitemap/context-dev";
import {
  deleteStoredSitemap,
  getStoredSitemapPages,
  listStoredSitemaps,
  saveStoredSitemap,
} from "@/lib/sitemap/storage";

import { badGateway, notFound, serviceUnavailable } from "../utils/errors";

const SITEMAP_NOT_FOUND_MESSAGE = "Sitemap not found";
const SITEMAP_STORAGE_UNAVAILABLE_MESSAGE = "Sitemap storage is unavailable";

async function assertSitemapBrandIdentity(
  organizationId: string,
  voiceId: string
) {
  const brandIdentity = await getSitemapBrandIdentity(organizationId, voiceId);

  if (!brandIdentity) {
    throw notFound("Brand identity not found");
  }

  return brandIdentity;
}

export const brandSitemapsRouter = {
  list: baseProcedure
    .input(voiceInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await assertSitemapBrandIdentity(input.organizationId, input.voiceId);

      try {
        const sitemaps = await listStoredSitemaps(
          input.organizationId,
          input.voiceId
        );
        return { sitemaps };
      } catch {
        throw serviceUnavailable(SITEMAP_STORAGE_UNAVAILABLE_MESSAGE);
      }
    }),
  pages: baseProcedure
    .input(listSitemapPagesSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await assertSitemapBrandIdentity(input.organizationId, input.voiceId);

      let result: Awaited<ReturnType<typeof getStoredSitemapPages>>;
      try {
        result = await getStoredSitemapPages(
          input.organizationId,
          input.voiceId,
          input.sitemapId,
          {
            category: input.category,
            cursor: input.cursor,
            limit: input.limit,
            query: input.query?.trim() || undefined,
          }
        );
      } catch {
        throw serviceUnavailable(SITEMAP_STORAGE_UNAVAILABLE_MESSAGE);
      }

      if (!result) {
        throw notFound(SITEMAP_NOT_FOUND_MESSAGE);
      }

      return result;
    }),
  create: baseProcedure
    .input(createSitemapSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const brandIdentity = await assertSitemapBrandIdentity(
        input.organizationId,
        input.voiceId
      );

      try {
        const result = await getContextDevSitemap({
          brandSettingsId: brandIdentity.id,
          label: input.label,
          url: input.url,
        });

        await saveStoredSitemap({
          organizationId: input.organizationId,
          pages: result.pages,
          sitemap: result.sitemap,
          voiceId: input.voiceId,
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.GEO_SITEMAP_ADDED,
          headers: context.headers,
          organizationId: input.organizationId,
          properties: {
            brand_identity_id: input.voiceId,
            page_count: result.pages.length,
          },
        });

        return result;
      } catch {
        throw badGateway("Failed to crawl sitemap");
      }
    }),
  delete: baseProcedure
    .input(deleteSitemapSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await assertSitemapBrandIdentity(input.organizationId, input.voiceId);

      let deleted: boolean;
      try {
        deleted = await deleteStoredSitemap({
          organizationId: input.organizationId,
          sitemapId: input.sitemapId,
          voiceId: input.voiceId,
        });
      } catch {
        throw serviceUnavailable(SITEMAP_STORAGE_UNAVAILABLE_MESSAGE);
      }

      if (!deleted) {
        throw notFound(SITEMAP_NOT_FOUND_MESSAGE);
      }

      return { ok: true };
    }),
};
