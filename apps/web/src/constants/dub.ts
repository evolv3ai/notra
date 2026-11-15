import type { ClearOnRevocationConfig, Script } from "c15t";

const DUB_COOKIE_DOMAIN = ".usenotra.com";
const DUB_REFERRAL_DOMAIN = "affiliate.usenotra.com";

export const DUB_ANALYTICS_SCRIPT: Script = {
  id: "dub-analytics",
  src: "https://www.dubcdn.com/analytics/script.conversion-tracking.js",
  category: "measurement",
  defer: true,
  attributes: {
    "data-publishable-key": "dub_pk_m49orh8wTqG4U3ZdNLXOcCUH",
    "data-cookie-options": JSON.stringify({ domain: DUB_COOKIE_DOMAIN }),
    "data-domains": JSON.stringify({ refer: DUB_REFERRAL_DOMAIN }),
  },
};

export const DUB_CLEAR_ON_REVOCATION: ClearOnRevocationConfig = {
  measurement: {
    cookies: [{ name: "dub_*", domain: DUB_COOKIE_DOMAIN, path: "/" }],
  },
};
