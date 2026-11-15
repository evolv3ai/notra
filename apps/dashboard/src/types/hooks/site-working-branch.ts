import type { useSiteDraftSaves } from "@/lib/hooks/use-site-draft-saves";
import type { SiteWorkingBranchProps } from "@/types/site-branches";
import type { SiteScope } from "@/types/sites";

export interface UseSiteWorkingBranchParams extends SiteScope {
  productionBranch: string;
  filesError: unknown;
  draftVersion: string;
  draftCount: number;
  paused?: boolean;
  saves: ReturnType<typeof useSiteDraftSaves>;
  onFlushed: () => void;
  onConflict: (paths: string[]) => void;
  onSwitch: SiteWorkingBranchProps["onSwitch"];
}
