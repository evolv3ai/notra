export interface IngestTokenIdentity {
  organizationId: string;
  projectId: string | null;
  generation: number;
}

export interface VerifyIngestTokenInput {
  secret: string;
  prefix: string;
  token: string;
}
