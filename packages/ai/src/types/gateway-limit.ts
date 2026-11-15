export type GatewayLimitType =
  | "daily-spend"
  | "daily-tokens"
  | "credit-balance"
  | "rate-limit"
  | "unknown";

export interface GatewayLimitDetails {
  limitType: GatewayLimitType;
  limitReason: string;
  retryAfterSeconds?: number;
  retryAt?: string;
  rateLimitResetAt?: string;
  requestLimit?: number;
  tokenLimit?: number;
}

export interface GatewayLimitDescription {
  name: string;
  reason: string;
  recovery: string;
}
