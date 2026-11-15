export interface TrafficPayload {
  timestamp: string;
  method: string;
  url: string;
  ip?: string;
  geo?: { country?: string };
  referer?: string;
  userAgent?: string;
  accept?: string;
  acceptLanguage?: string;
  requestId?: string;
  status?: number;
  signals: {
    clientHints: boolean;
    fetchMode: string | null;
    prefetch: boolean;
    tracing: boolean;
  };
  visitorConsent?: boolean;
}

export interface TrafficReport {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  ingestUrl: string;
  token: string;
  request: Request;
  method: string;
  referer: string | null;
  publicUrl: string;
  proxied: boolean;
  status: number;
  visitorConsent?: boolean;
}

export interface EngagementEvent {
  kind: "engagement";
  viewId: string;
  path: string;
  visibleMs: number;
  scrollDepth: number;
}

export interface PageViewEvent {
  kind: "view";
  path: string;
  referrer: string;
}

export type AnalyticsEvent = EngagementEvent | PageViewEvent;

export interface EngagementReport {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  ingestUrl: string;
  token: string;
  publicOrigin: string;
  event: EngagementEvent;
}

export interface IngestPost {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  ingestUrl: string;
  token: string;
  kind: "traffic" | "engagement";
  buildBody: () => TrafficPayload | Record<string, unknown>;
}
