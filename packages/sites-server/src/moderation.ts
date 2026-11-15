import { moderateSiteName } from "@notra/ai/jobs/site-name-moderation";
import { db } from "@notra/db/drizzle";
import { organizations, siteSlugGrants, users } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import {
  SITE_NAME_REJECTION_MESSAGES,
  SITE_PROTECTED_SLUG_WORDS,
  SITE_RESERVED_BRAND_SLUGS,
  SITE_SIGN_IN_SLUG_WORDS,
} from "./constants/moderation";
import { SITE_SLUG_RETIRED_NOTE } from "./constants/sites";
import { SiteInputError } from "./errors/sites";
import type { SiteNameRejection, SiteNameRejectionParams } from "./types/sites";
import { reservedSlugMessage, slugContainsWord } from "./utils/moderation";

async function ownsReservedDomain(
  userId: string,
  domain: string
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    columns: { email: true, emailVerified: true },
    where: eq(users.id, userId),
  });
  const emailDomain = user?.email.split("@")[1]?.toLowerCase();
  if (!(user?.emailVerified && emailDomain)) {
    return false;
  }
  return emailDomain === domain || emailDomain.endsWith(`.${domain}`);
}

async function siteNameRejection(
  params: SiteNameRejectionParams
): Promise<SiteNameRejection | null> {
  const { slug } = params;
  if (slug) {
    const grant = await db.query.siteSlugGrants.findFirst({
      columns: { organizationId: true, note: true },
      where: eq(siteSlugGrants.slug, slug),
    });
    if (grant && grant.organizationId !== params.organizationId) {
      return { message: SITE_NAME_REJECTION_MESSAGES.granted, field: "slug" };
    }
    // Staff grants are trusted outright. A slug kept after deleting a site
    // only keeps other organizations out; it gets every check a free slug gets.
    if (grant && grant.note !== SITE_SLUG_RETIRED_NOTE) {
      return null;
    }
    if (slugContainsWord(slug, SITE_PROTECTED_SLUG_WORDS)) {
      return {
        message: SITE_NAME_REJECTION_MESSAGES.protected,
        field: "slug",
      };
    }
    if (slugContainsWord(slug, SITE_SIGN_IN_SLUG_WORDS)) {
      return {
        message: SITE_NAME_REJECTION_MESSAGES.signIn,
        field: "slug",
      };
    }
    const reservedFor = SITE_RESERVED_BRAND_SLUGS[slug];
    if (reservedFor) {
      return (await ownsReservedDomain(params.userId, reservedFor))
        ? null
        : { message: reservedSlugMessage(slug, reservedFor), field: "slug" };
    }
  }
  const organization = await db.query.organizations.findFirst({
    columns: { name: true },
    where: eq(organizations.id, params.organizationId),
  });
  const verdict = await moderateSiteName({
    organizationId: params.organizationId,
    organizationName: organization?.name ?? "",
    name: params.name,
    address: params.address,
  });
  return verdict
    ? { message: SITE_NAME_REJECTION_MESSAGES[verdict], field: "name" }
    : null;
}

export async function assertSiteNameAllowed(
  params: SiteNameRejectionParams
): Promise<void> {
  const rejection = await siteNameRejection(params);
  if (rejection) {
    throw new SiteInputError(rejection.message, { field: rejection.field });
  }
}
