import { FAVICON_DOMAIN_OVERRIDES } from "@notra/utils/constants/favicon";

const GOOGLE_FAVICON_SIZE = 128;

// RFC 2606 reserves the `.example` TLD (the demo's fictional brands) and
// example.com/.net/.org (sample data); none of them has a favicon.
const RESERVED_EXAMPLE_DOMAIN = /(?:^|\.)example(?:\.(?:com|net|org))?$/i;

export function isReservedExampleDomain(domain: string | null): boolean {
  return domain !== null && RESERVED_EXAMPLE_DOMAIN.test(domain);
}

export function googleFaviconUrl(
  domain: string | null,
  size = GOOGLE_FAVICON_SIZE
): string | null {
  if (!domain || isReservedExampleDomain(domain)) {
    return null;
  }

  const url = new URL("https://www.google.com/s2/favicons");
  const host = domain.toLowerCase().replace(/^www\./, "");
  url.searchParams.set("domain", FAVICON_DOMAIN_OVERRIDES[host] ?? domain);
  url.searchParams.set("sz", String(size));
  return url.toString();
}
