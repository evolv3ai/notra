import type { ClearOnRevocationConfig, Script } from "c15t";

const DUB_COOKIE_DOMAIN = ".usenotra.com";
const DUB_REFERRAL_DOMAIN = "affiliate.usenotra.com";

export const DUB_CLICK_ID_COOKIE = "dub_id";
export const DUB_CUSTOMER_EXTERNAL_ID_METADATA_KEY = "dubCustomerExternalId";
export const DUB_TRACK_LEAD_URL = "https://api.dub.co/track/lead";
export const DUB_SIGN_UP_EVENT = "Sign Up";
export const DUB_REQUEST_TIMEOUT_MS = 5000;

export const DUB_ANALYTICS_SCRIPTS: Script[] = [
  {
    id: "dub-analytics",
    src: "https://www.dubcdn.com/analytics/script.conversion-tracking.js",
    category: "measurement",
    defer: true,
    attributes: {
      "data-publishable-key": "dub_pk_m49orh8wTqG4U3ZdNLXOcCUH",
      "data-cookie-options": JSON.stringify({ domain: DUB_COOKIE_DOMAIN }),
      "data-domains": JSON.stringify({ refer: DUB_REFERRAL_DOMAIN }),
    },
  },
];

export const DUB_CLEAR_ON_REVOCATION: ClearOnRevocationConfig = {
  measurement: {
    cookies: [{ name: "dub_*", domain: DUB_COOKIE_DOMAIN, path: "/" }],
  },
};
