import { SITE_ABUSE_EMAIL } from "@notra/sites-core/constants/sites";

function abuseMailto(subject: string, body: string): string {
  return `mailto:${SITE_ABUSE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** A prefilled email to the abuse inbox about the page at `url`. */
export function siteAbuseReportHref(url: string): string {
  return abuseMailto(
    `Abuse report: ${new URL(url).host}`,
    `Page: ${url}\n\nWhat is wrong with it:\n`
  );
}

/** A prefilled appeal from the owner of a suspended site. */
export function siteSuspensionAppealHref(url: string): string {
  return abuseMailto(
    `Appeal: ${new URL(url).host}`,
    `Site: ${new URL(url).origin}\n\nWhy it should be restored:\n`
  );
}
