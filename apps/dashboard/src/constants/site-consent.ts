import { InthIcon } from "@/components/icons/inth-icon";

export const INTH_OAUTH_ERRORS = [
  "inth_not_configured",
  "inth_access_denied",
  "inth_auth_failed",
  "inth_expired_state",
  "inth_session_mismatch",
  "inth_rate_limited",
  "inth_forbidden",
  "inth_invalid_callback",
] as const;

export const C15T_DOCS_URL =
  "https://www.usenotra.com/docs/sites/integrations/consent/c15t";

export const INTH_PROVIDER = {
  name: "Inth",
  logo: InthIcon,
  fill: true,
} as const;

export const CONSENT_HOSTING_MODES = ["managed", "selfHosted"] as const;

export const C15T_SELF_HOSTED_BACKEND_URL = "https://consent.acme.com/api/c15t";
