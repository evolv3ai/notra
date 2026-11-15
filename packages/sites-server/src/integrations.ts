import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { siteIntegrationsSchema } from "@notra/sites-core/schemas/site-integrations";

import {
  discardSiteDraft,
  readSiteDraft,
  readSiteSourceFile,
  saveSiteDraft,
} from "./editor";
import type {
  SaveSiteIntegrationsInput,
  SiteIntegrationConfigUpdate,
  SiteIntegrationsState,
} from "./types/integrations";
import type { Site } from "./types/sites";
import { defaultSiteConfigContent } from "./utils/default-config";
import { isRecord } from "./utils/json";
import {
  parseSiteIntegrationConfig,
  updateSiteIntegrationConfig,
} from "./utils/site-integration-config";
import { siteSourceContext } from "./utils/source-context";

async function currentConfig(site: Site, branch = site.productionBranch) {
  const [file, draft] = await Promise.all([
    readSiteSourceFile(site, SITE_CONFIG_FILENAME, branch),
    readSiteDraft(site, SITE_CONFIG_FILENAME, branch),
  ]);
  const content =
    draft && !draft.deleted
      ? draft.content
      : (file?.content ?? defaultSiteConfigContent(site));
  return { file, draft, content };
}

export async function readSiteIntegrations(
  site: Site,
  branch?: string
): Promise<SiteIntegrationsState> {
  const { content, draft } = await currentConfig(site, branch);
  const config = parseSiteIntegrationConfig(content);
  return {
    integrations: isRecord(config?.integrations) ? config.integrations : {},
    hasDraft: Boolean(draft),
    invalid:
      config === null ||
      !siteIntegrationsSchema.safeParse(config.integrations).success,
  };
}

export async function saveSiteIntegration(
  site: Site,
  input: SaveSiteIntegrationsInput
): Promise<SiteIntegrationsState> {
  return await saveSiteIntegrationUpdate(
    site,
    () => input,
    input.userId,
    input.branch
  );
}

export async function saveSiteC15tBackend(
  site: Site,
  backendURL: string,
  userId: string,
  branch?: string
): Promise<SiteIntegrationsState> {
  return await saveSiteIntegrationUpdate(
    site,
    (integrations) => ({
      provider: "c15t",
      settings: {
        ...(isRecord(integrations.c15t) ? integrations.c15t : {}),
        backendURL,
      },
    }),
    userId,
    branch
  );
}

async function saveSiteIntegrationUpdate(
  site: Site,
  toUpdate: (
    integrations: Record<string, unknown>
  ) => SiteIntegrationConfigUpdate,
  userId: string,
  branch = site.productionBranch
): Promise<SiteIntegrationsState> {
  const { file, draft, content } = await currentConfig(site, branch);
  const config = parseSiteIntegrationConfig(content);
  const { integrations, content: next } = updateSiteIntegrationConfig(
    content,
    toUpdate(isRecord(config?.integrations) ? config.integrations : {})
  );
  const observed = {
    branch,
    path: SITE_CONFIG_FILENAME,
    draftId: draft?.id ?? null,
    draftRevision: draft?.revision ?? null,
    sourceContext: siteSourceContext(site),
  };
  if (file && next === file.content) {
    await discardSiteDraft(site, observed);
    return { integrations, hasDraft: false, invalid: false };
  }
  await saveSiteDraft(site, {
    ...observed,
    content: next,
    baseBlobSha: draft ? draft.baseBlobSha : (file?.sha ?? null),
    baseCommitSha: draft?.baseCommitSha ?? null,
    userId,
  });
  return { integrations, hasDraft: true, invalid: false };
}
