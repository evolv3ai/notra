import { createSerializer, parseAsString } from "nuqs";

export const DATABUDDY_SIGNUP_STARTED_EVENT = "signup_started";

export const DATABUDDY_EXPERIMENT_EXPOSED_EVENT = "experiment_exposed";

export const DATABUDDY_HERO_CTA_CLICKED_EVENT = "hero_cta_clicked";

export const LANDING_EXPERIMENT_VARIANT_STORAGE_KEY =
  "notra_landing_experiment_variant";

const signupAttributionSearchParams = {
  source: parseAsString,
  variant: parseAsString,
};

const signupAttributionUrlKeys = {
  source: "db_source",
  variant: "db_landing_page_h1_variant",
} as const;

export const serializeSignupAttribution = createSerializer(
  signupAttributionSearchParams,
  {
    urlKeys: signupAttributionUrlKeys,
  }
);
