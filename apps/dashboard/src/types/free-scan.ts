export type FreeScanSkipReason =
  | "billing_unavailable"
  | "email_unverified"
  | "no_company_domain"
  | "already_claimed"
  | "no_prompts"
  | "no_organization"
  | "scan_running";

export type FreeScanResult =
  | { started: true; scanId: string; promptCount: number }
  | { started: false; reason: FreeScanSkipReason };
