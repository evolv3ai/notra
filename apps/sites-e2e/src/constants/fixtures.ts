export const SITE_ID = "site_e2e";
// A real-looking hosting domain: vendors' scripts skip *.localhost as local
// development (Databuddy does since 2026-10-24). `.test` never resolves
// publicly; Chromium maps it to the local Worker.
export const HOSTING_DOMAIN = "sites-e2e.test";
export const LIVE_HOST = `acme.${HOSTING_DOMAIN}`;
export const PREVIEW_HOST = `pr-7--acme.${HOSTING_DOMAIN}`;
export const PREVIEW_SECRET = "synthetic-e2e-preview-secret-never-production";
export const PREVIEW_PASSWORD = "synthetic-preview-password";
export const TRAFFIC_TOKEN = "synthetic-e2e-traffic-token";
export const OTHER_SITE_ID = "site_e2e_globex";
export const OTHER_SITE_SLUG = "globex";
export const OTHER_HOST = `${OTHER_SITE_SLUG}.${HOSTING_DOMAIN}`;
export const OTHER_CUSTOM_HOST = "docs.globex.example";
export const STALE_ALIAS_HOST = `globex-old.${HOSTING_DOMAIN}`;
export const CONSENT_SITE_ID = "site_e2e_consent";
export const CONSENT_HOST = `consent.${HOSTING_DOMAIN}`;
export const CONSENT_TLS_SITE_ID = "site_e2e_consent_tls";
export const CONSENT_TLS_HOST = `consent-tls.${HOSTING_DOMAIN}`;
export const UNKNOWN_HOST = `nobody.${HOSTING_DOMAIN}`;
export const SUSPENDED_SITE_ID = "site_e2e_suspended";
export const SUSPENDED_HOST = `suspended.${HOSTING_DOMAIN}`;
export const ACME_TEXT = ["Acme", "A draft idea", "Hello world"];
