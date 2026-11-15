import type { ContentPublishingConfig } from "@/types/content/git-publishing";

export function resolveGitHubPublishingSiteId(
  siteId: string | undefined,
  config: ContentPublishingConfig | undefined
) {
  const preferred = siteId ?? config?.siteId;
  if (config?.sites.some((site) => site.id === preferred)) {
    return preferred ?? undefined;
  }
  return config?.sites.length === 1 ? config.sites[0]?.id : undefined;
}
