import {
  SITE_ANALYTICS_EVENT_FILE,
  SITE_ANALYTICS_SCRIPT_FILE,
} from "@notra/sites-core/constants/sites";
import {
  joinMountPath,
  resolveAreaForPath,
} from "@notra/sites-core/utils/mounts";

import type {
  AnalyticsScriptTag,
  LoadedManifest,
  ResolvedDeployment,
} from "../types/serving";
import { normalizeRequestPath } from "./routing";

function analyticsMount(
  loaded: LoadedManifest,
  pathname: string
): string | null {
  const path = normalizeRequestPath(pathname);
  if (path === null) {
    return null;
  }
  return resolveAreaForPath(loaded.manifest.target.mounts, path)?.mount ?? "/";
}

export function analyticsScriptTag(
  resolved: ResolvedDeployment,
  loaded: LoadedManifest,
  pathname: string,
  visitorConsent: boolean | undefined
): AnalyticsScriptTag | null {
  const mount = resolved.trafficToken ? analyticsMount(loaded, pathname) : null;
  return mount === null
    ? null
    : {
        scriptSrc: joinMountPath(mount, SITE_ANALYTICS_SCRIPT_FILE),
        eventPath: joinMountPath(mount, SITE_ANALYTICS_EVENT_FILE),
        consent: visitorConsent !== undefined,
        reportsView: visitorConsent === false,
      };
}
