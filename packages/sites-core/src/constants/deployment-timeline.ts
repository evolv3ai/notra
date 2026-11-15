export const SITE_DEPLOYMENT_PHASES = [
  "preparing",
  "building",
  "deploying",
] as const;

export const SITE_DEPLOYMENT_PHASE_MARKER =
  /^\[deployment:(preparing|building|deploying)\] (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;
