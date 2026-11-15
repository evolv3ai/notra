import { p } from "@tinybirdco/sdk";

import {
  GEO_SITES_MODE_PARAM,
  GEO_HOSTS_PARAMS,
  GEO_HOSTS_SQL,
  GEO_PROJECT_SCOPE_PARAMS,
  GEO_PROJECT_SCOPE_SQL,
  GEO_SITE_SCOPE_SQL,
  GEO_WINDOW_PARAMS,
} from "./geo-queries";

const WEB_SCOPE_PARAMS = {
  site_id: p
    .string()
    .optional("")
    .describe("Notra Site id, empty for every site and SDK host"),
  ...GEO_SITES_MODE_PARAM,
  ...GEO_HOSTS_PARAMS,
};

export const WEB_SCOPE_SQL = `${GEO_SITE_SCOPE_SQL}
          ${GEO_HOSTS_SQL}`;

export const WEB_LANDING_SQL = "session_page_index <= 1";

export const WEB_QUERY_PARAMS = {
  organization_id: p.string().describe("Organization id"),
  ...GEO_PROJECT_SCOPE_PARAMS,
  ...WEB_SCOPE_PARAMS,
  ...GEO_WINDOW_PARAMS,
};

export const WEB_PAGES_WHERE = `WHERE organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}`;

export const WEB_PATH_SET = `{{String(path, '')}} != ''`;

/** Raw page views for one path; empty when no path filter is set. */
export const WEB_RAW_WHERE = `WHERE ${WEB_PATH_SET}
          AND organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}
          AND path = {{String(path, '')}}`;

export const WEB_AUDIENCE_VALUE_SQL = `multiIf(
            {{String(dimension, 'country')}} = 'device', device,
            {{String(dimension, 'country')}} = 'browser', browser,
            {{String(dimension, 'country')}} = 'os', os,
            country
          )`;
