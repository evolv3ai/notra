import { SITE_ASSETS_DIR } from "@notra/sites-core/constants/sites";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import type { SiteHeadScript } from "@notra/sites-core/types/site-integrations";
import {
  analyticsGatedByConsent,
  integrationHeadScripts,
} from "@notra/sites-core/utils/integrations";
import { joinMountPath } from "@notra/sites-core/utils/mounts";

import type { PreparedCustomScript } from "../types/source";

export function siteHeadScripts(
  config: SiteConfig,
  mount: string,
  customScripts: readonly PreparedCustomScript[],
  analytics: boolean,
  hostingDomain?: string
): SiteHeadScript[] {
  const gated = config.integrations.c15t?.scripts ?? {};
  return [
    ...(analytics && !analyticsGatedByConsent(config.integrations)
      ? integrationHeadScripts(config.integrations, hostingDomain)
      : []),
    ...customScripts
      .filter((script) => !gated[script.path])
      .map((script): SiteHeadScript => ({
        kind: "external",
        src: joinMountPath(mount, `${SITE_ASSETS_DIR}/${script.fileName}`),
        attributes: { defer: true },
      })),
  ];
}
