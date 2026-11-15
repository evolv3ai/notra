import type * as z from "zod";

import type { saveFreeScanClaimInputSchema } from "@/schemas/free-scans";

export type SaveFreeScanClaimInput = z.infer<
  typeof saveFreeScanClaimInputSchema
>;

export type SaveFreeScanClaimResult =
  | "saved"
  | "organization_not_found"
  | "claim_active";

export interface FreeScanClaimRow {
  domain: string;
  promptLimit: number;
  organizationName: string | null;
  organizationSlug: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
}

export interface FreeScanFormState {
  domain: string;
  promptLimit: string;
  organizationSlug: string;
}

export interface FreeScansRouteProps {
  params: Promise<{ slug: string }>;
}
