export { withGitHubRateLimitHandling } from "@notra/ai/utils/github-rate-limit";

export function getPublicGithubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "notra-onboarding-agent",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

const LINK_HEADER_NEXT_PAGE_REGEX = /<([^>]+)>\s*;\s*rel="next"/i;

export function getNextPageFromLinkHeader(
  linkHeader?: string | number
): number | undefined {
  if (typeof linkHeader !== "string" || !linkHeader.trim()) {
    return undefined;
  }
  const nextMatch = linkHeader.match(LINK_HEADER_NEXT_PAGE_REGEX);
  if (!nextMatch?.[1]) {
    return undefined;
  }
  try {
    const url = new URL(nextMatch[1]);
    const pageValue = url.searchParams.get("page");
    if (!pageValue) {
      return undefined;
    }
    const parsed = Number.parseInt(pageValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export const getISODateFromDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};
