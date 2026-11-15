/** Mirrors `SITE_R2_KEYS` in `packages/sites-core/src/constants/sites.ts`. */
export const SITE_R2_KEYS = {
  state: (siteId: string) => `sites/${siteId}/state.json`,
  buildLog: (siteId: string, deploymentId: string) =>
    `logs/${siteId}/${deploymentId}.log`,
};
