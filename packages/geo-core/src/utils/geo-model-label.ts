import {
  GEO_MODEL_HYPHEN_PREFIXES,
  GEO_MODEL_TOKEN_LABELS,
} from "../constants/geo-model-labels";

const VERSION_TOKEN = /^v?\d/i;
const ALPHA_TOKEN = /^[a-z]+$/i;
const ALPHA_PREFIX_WITH_DIGITS = /^([a-z]+)(\d.*)$/i;

function ownTokenLabel(token: string): string | undefined {
  return Object.hasOwn(GEO_MODEL_TOKEN_LABELS, token)
    ? GEO_MODEL_TOKEN_LABELS[token]
    : undefined;
}

function formatModelToken(token: string): string {
  const lower = token.toLowerCase();
  const known = ownTokenLabel(lower);
  if (known) {
    return known;
  }
  if (ALPHA_TOKEN.test(token)) {
    return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
  }
  const match = ALPHA_PREFIX_WITH_DIGITS.exec(lower);
  if (match) {
    const [, prefix = "", rest = ""] = match;
    const prefixLabel = ownTokenLabel(prefix);
    if (prefixLabel) {
      return `${prefixLabel}${rest}`;
    }
  }
  return lower;
}

/** A model slug without a catalog label, spelled out: "gpt-5.6-sol" → "GPT-5.6 Sol". */
export function formatModelSlug(slug: string): string {
  const parts = slug.split("-").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return slug;
  }

  const labels = parts.map(formatModelToken);
  let result = labels[0] ?? slug;
  for (let index = 1; index < labels.length; index++) {
    const previous = parts[index - 1]?.toLowerCase() ?? "";
    const current = parts[index]?.toLowerCase() ?? "";
    const label = labels[index];
    if (!label) {
      continue;
    }
    if (
      GEO_MODEL_HYPHEN_PREFIXES.has(previous) &&
      VERSION_TOKEN.test(current)
    ) {
      result += `-${label}`;
      continue;
    }
    result += ` ${label}`;
  }
  return result;
}
