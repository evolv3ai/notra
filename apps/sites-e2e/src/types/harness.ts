export interface Measurement {
  name: string;
  repetition: number;
  durationMs: number;
}

export interface FixtureBuild {
  siteId: string;
  deploymentId: string;
  publicOrigin: string;
  preview: boolean;
  integrations: Record<string, unknown>;
}

export interface ProviderRequest {
  provider: string;
  url: string;
  method: string;
  body: string | null;
  at: number;
}

export interface IngestRequest {
  url: string;
  authorization: string | null;
  body: Record<string, unknown>;
}
