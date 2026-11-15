import {
  OFFERING_HOSTNAME_PATTERN,
  OFFERING_PROTOCOL_PATTERN,
  OFFERING_WWW_PATTERN,
} from "@/constants/offering-check";

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }
  const withProtocol = OFFERING_PROTOCOL_PATTERN.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (!URL.canParse(withProtocol)) {
    return null;
  }
  const hostname = new URL(withProtocol).hostname.replace(
    OFFERING_WWW_PATTERN,
    ""
  );
  return OFFERING_HOSTNAME_PATTERN.test(hostname) ? hostname : null;
}

export function domainOfUrl(url: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  return parsed.hostname.toLowerCase().replace(OFFERING_WWW_PATTERN, "");
}
