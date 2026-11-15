import { competitorKey } from "../geo/domain";

const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/**
 * Looser than `competitorKey`: "Peec AI", "Peec.ai" and "peec-ai" are the same
 * brand to a reader. Mirrors the SQL fold in `brandMentionedWhere`.
 */
export function brandFoldKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(NON_ALPHANUMERIC, "");
}

/**
 * Every folded spelling that counts as `brand`: its own, plus the name and
 * synonyms of the tracked competitor it belongs to.
 */
export function competitorBrandFoldKeys(
  brand: string,
  competitors: readonly { name: string; synonyms?: readonly string[] }[]
): string[] {
  const brandKey = brandFoldKey(brand);
  const keys = new Set([brandKey]);
  for (const competitor of competitors) {
    const names = [competitor.name, ...(competitor.synonyms ?? [])];
    if (names.some((name) => brandFoldKey(name) === brandKey)) {
      for (const name of names) {
        keys.add(brandFoldKey(name));
      }
    }
  }
  keys.delete("");
  return [...keys];
}

/** Maps canonical competitor names and their synonyms onto the canonical name. */
export function competitorCanonicalMap(
  competitors: readonly {
    name: string;
    synonyms?: readonly string[];
  }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const competitor of competitors) {
    const nameKey = competitorKey(competitor.name);
    if (nameKey.length === 0) {
      continue;
    }
    map.set(nameKey, competitor.name);
    for (const synonym of competitor.synonyms ?? []) {
      const key = competitorKey(synonym);
      if (key.length > 0 && !map.has(key)) {
        map.set(key, competitor.name);
      }
    }
  }
  return map;
}

export function isGeoOwnBrandName(
  name: string,
  companyName: string | null | undefined,
  aliases: readonly string[] = []
): boolean {
  const key = competitorKey(name);
  if (key.length === 0 || !companyName) {
    return false;
  }
  return [companyName, ...aliases].some((own) => competitorKey(own) === key);
}
