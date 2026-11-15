import type {
  CONSENT_HOSTING_MODES,
  INTH_OAUTH_ERRORS,
} from "@/constants/site-consent";
import type { useInthConsent } from "@/lib/hooks/use-site-consent";

export type InthOAuthErrorCode = (typeof INTH_OAUTH_ERRORS)[number];

export type ConsentHostingMode = (typeof CONSENT_HOSTING_MODES)[number];

export type InthConsent = ReturnType<typeof useInthConsent>;

export type InthConsentStatus = NonNullable<InthConsent["status"]["data"]>;
