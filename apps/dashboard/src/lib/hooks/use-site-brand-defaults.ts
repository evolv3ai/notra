import { useSite } from "@/components/sites/site-context";
import { useBrandGuidelines } from "@/lib/hooks/use-brand-guidelines";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import type { SiteBrandDefaultsState } from "@/types/site-design";
import { brandDefaultsFromGuidelines } from "@/utils/site-design";

/** Colors, logos and fonts from the brand identity of a project. */
export function useProjectBrandDefaults(
  organizationId: string,
  projectId: string
): SiteBrandDefaultsState {
  const { projects, isLoading: projectsLoading } =
    useGeoProjectsDb(organizationId);
  const brandSettingsId =
    projects.find((project) => project.id === projectId)?.brandSettingsId ?? "";
  const { data } = useBrandGuidelines(organizationId, brandSettingsId);
  const brand = data ? brandDefaultsFromGuidelines(data) : null;
  // Every project has a brand identity, so the row holds its place while
  // the project and its guidelines load instead of appearing afterwards.
  return {
    brand,
    available: projectsLoading || brandSettingsId.length > 0,
  };
}

/** Brand identity defaults of the current site's project. */
export function useSiteBrandDefaults(): SiteBrandDefaultsState {
  const { organizationId, detail } = useSite();
  return useProjectBrandDefaults(organizationId, detail.site.projectId);
}
