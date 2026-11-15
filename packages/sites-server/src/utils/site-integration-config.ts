import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { siteIntegrationsSchema } from "@notra/sites-core/schemas/site-integrations";

import { SiteInputError } from "../errors/sites";
import type { SiteIntegrationConfigUpdate } from "../types/integrations";
import { isRecord, safeJson } from "./json";

export function parseSiteIntegrationConfig(
  content: string | undefined
): Record<string, unknown> | null {
  const parsed = content === undefined ? {} : safeJson(content);
  return isRecord(parsed) ? parsed : null;
}

export function updateSiteIntegrationConfig(
  content: string | undefined,
  update: SiteIntegrationConfigUpdate
) {
  const config = parseSiteIntegrationConfig(content);
  if (!config) {
    throw new SiteInputError(
      `${SITE_CONFIG_FILENAME} isn't valid JSON. Fix it in the editor first.`
    );
  }
  if (config.integrations !== undefined && !isRecord(config.integrations)) {
    throw new SiteInputError(
      `integrations in ${SITE_CONFIG_FILENAME} must be an object. Fix it in the editor first.`
    );
  }
  const current = isRecord(config.integrations)
    ? { ...config.integrations }
    : {};
  if (update.settings === null) {
    delete current[update.provider];
  } else {
    current[update.provider] = update.settings;
  }
  const parsed = siteIntegrationsSchema.safeParse(current);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SiteInputError(
      `integrations${issue?.path.length ? `.${issue.path.join(".")}` : ""}: ${issue?.message ?? "Check the integration settings"}`
    );
  }
  if (update.settings !== null && update.provider !== "c15t") {
    current[update.provider] = parsed.data[update.provider];
  }
  if (Object.keys(current).length > 0) {
    config.integrations = current;
  } else {
    delete config.integrations;
  }
  return {
    integrations: current,
    content: `${JSON.stringify(config, null, 2)}\n`,
  };
}
