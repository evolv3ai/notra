import type { SiteBuildTarget } from "@notra/sites-core/types/deployment";
import { sha256Hex } from "@notra/sites-core/utils/hash";
import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";
import { stableStringify } from "@notra/sites-core/utils/stable-stringify";

function normalizeBuildTarget(target: SiteBuildTarget): SiteBuildTarget {
  return {
    publicOrigin: new URL(target.publicOrigin).origin,
    mounts: normalizeSiteMounts(target.mounts),
    noindex: target.noindex,
    branding: target.branding !== false,
  };
}

export async function hashBuildTarget(
  target: SiteBuildTarget
): Promise<string> {
  const { branding, ...normalized } = normalizeBuildTarget(target);
  const hashed = branding ? normalized : { ...normalized, branding };
  const digest = await sha256Hex(
    new TextEncoder().encode(stableStringify(hashed))
  );
  return digest.slice(0, 16);
}
