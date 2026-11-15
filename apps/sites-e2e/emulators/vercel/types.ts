export interface VercelEmulatorOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Zones the emulated account manages (their NS records are seeded). */
  zones: string[];
}

export interface VercelGrant {
  code: string;
  accessToken: string;
  configurationId: string;
  teamId: string | null;
  removed: boolean;
}
