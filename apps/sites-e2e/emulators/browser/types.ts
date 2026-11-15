export type VendorScripts = "emulated" | "live";

export interface CollectedEvent {
  provider: string;
  url: string;
  method: string;
  /** Request body, decompressed when the vendor gzips it. */
  body: string | null;
  at: number;
}

// One analytics integration a site can enable. Emulated mode serves
// `standIn` for `script` and checks the exact payload; live mode loads the
// vendor's real script and checks the vendor contract: a page view for the
// current page that carries `identifier`.
export interface AnalyticsProvider {
  name: string;
  /** The integration settings the fixture site is built with. */
  settings: Record<string, unknown>;
  /** The CDN script URL the site's integration renders. */
  script: string;
  /** File in apps/sites-e2e/fixtures served for `script` when emulated. */
  standIn: string;
  /** Collection endpoint the stand-in posts to. */
  endpoint: string;
  /** Script/config requests the real script may make (live mode only). */
  isLiveAsset(url: URL): boolean;
  /** Config lookups answered locally in live mode (JSON body), if any. */
  answerLive?(url: URL): unknown;
  /** Whether a request is the real script's collection call. */
  isLiveCollect(url: URL): boolean;
  /** Configured ID the vendor must send (site ID, measurement ID, key). */
  identifier: string;
  /** Whether a live collection call is this page's page view. */
  isLivePageView(event: CollectedEvent, page: URL): boolean;
  assertEmulated(event: CollectedEvent, pageUrl: string): void;
}
