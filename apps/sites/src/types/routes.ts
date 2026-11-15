import type {
  SiteManifestFile,
  SiteMountedArea,
  SitePreviewPointer,
} from "@notra/sites-core/types/deployment";
import type { Effect, Option } from "effect";

import type { PreviewRequestContext } from "./preview-auth";
import type {
  LoadedManifest,
  ResolvedDeployment,
  ServeFileParams,
  SiteRequestContext,
} from "./serving";
import type { SitesDeps } from "./worker";

export type SiteRoute<Context> = (
  context: Context
) => Effect.Effect<Option.Option<Response>>;

export interface RequestRouteContext {
  deps: SitesDeps;
  request: Request;
  url: URL;
  host: string;
}

export interface PreviewRouteContext extends PreviewRequestContext {
  pointer: SitePreviewPointer;
}

export interface DeploymentRouteContext extends SiteRequestContext {
  resolved: ResolvedDeployment;
  loaded: LoadedManifest;
  visitorConsent: boolean | undefined;
}

export type ManifestFileParams = Omit<ServeFileParams, "file" | "extraHeaders">;

export interface ManifestRouteContext extends DeploymentRouteContext {
  path: string;
  area: SiteMountedArea | null;
  markdownNotFoundPath: string;
  wantsMarkdown: boolean;
  file: SiteManifestFile | null;
  twin: SiteManifestFile | null;
  fileParams: ManifestFileParams;
}
