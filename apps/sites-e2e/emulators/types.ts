import type { GitHubEmulatorOptions } from "./github/types";

export interface SitesEmulatorsOptions {
  directory: string;
  github: Omit<GitHubEmulatorOptions, "directory">;
  /** Emulate the Upstash Box API; false when a real Box account is used. */
  box: boolean;
  /** Zones the emulated Vercel account manages. */
  vercelZones: string[];
  dashboardUrl: string;
  hostingDomain: string;
}
