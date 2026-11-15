import type { SiteEditorSourceContext } from "../types/editor";
import type { Site } from "../types/sites";

export function siteSourceContext(
  site: Pick<Site, "githubRepositoryId" | "productionBranch" | "rootDirectory">
): SiteEditorSourceContext {
  return {
    repositoryId: site.githubRepositoryId ?? "",
    productionBranch: site.productionBranch,
    rootDirectory: site.rootDirectory,
  };
}
