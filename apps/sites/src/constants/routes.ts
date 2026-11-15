import { analyticsEndpointsRoute } from "../routes/analytics-endpoints";
import { faviconRoute } from "../routes/favicon";
import { hostingApexRoute } from "../routes/hosting-apex";
import { htmlNotFoundRoute } from "../routes/html-not-found";
import { manifestRedirectsRoute } from "../routes/manifest-redirects";
import { markdownFileRoute } from "../routes/markdown-file";
import { markdownNotFoundRoute } from "../routes/markdown-not-found";
import { markdownTwinRoute } from "../routes/markdown-twin";
import { methodNotAllowedRoute } from "../routes/method-not-allowed";
import { mountRobotsTxtRoute } from "../routes/mount-robots-txt";
import { previewAccessGateRoute } from "../routes/preview-access-gate";
import { previewAuthRoute } from "../routes/preview-auth";
import { previewRobotsTxtRoute } from "../routes/preview-robots-txt";
import { previewSignOutRoute } from "../routes/preview-sign-out";
import { robotsTxtRoute } from "../routes/robots-txt";
import { rootRedirectRoute } from "../routes/root-redirect";
import { sitemapIndexRoute } from "../routes/sitemap-index";
import { staticFileRoute } from "../routes/static-file";
import { trailingSlashRedirectRoute } from "../routes/trailing-slash-redirect";
import { wellKnownLlmsTxtRoute } from "../routes/well-known-llms-txt";
import type {
  DeploymentRouteContext,
  ManifestRouteContext,
  PreviewRouteContext,
  RequestRouteContext,
  SiteRoute,
} from "../types/routes";

export const REQUEST_ROUTES: readonly SiteRoute<RequestRouteContext>[] = [
  methodNotAllowedRoute,
  hostingApexRoute,
];

export const PREVIEW_ROUTES: readonly SiteRoute<PreviewRouteContext>[] = [
  previewAuthRoute,
  previewSignOutRoute,
  previewRobotsTxtRoute,
  previewAccessGateRoute,
];

export const DEPLOYMENT_ROUTES: readonly SiteRoute<DeploymentRouteContext>[] = [
  analyticsEndpointsRoute,
  faviconRoute,
];

export const MANIFEST_ROUTES: readonly SiteRoute<ManifestRouteContext>[] = [
  robotsTxtRoute,
  mountRobotsTxtRoute,
  manifestRedirectsRoute,
  sitemapIndexRoute,
  wellKnownLlmsTxtRoute,
  trailingSlashRedirectRoute,
  markdownFileRoute,
  markdownTwinRoute,
  staticFileRoute,
  rootRedirectRoute,
  markdownNotFoundRoute,
  htmlNotFoundRoute,
];
