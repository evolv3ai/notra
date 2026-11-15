import { createHash, randomBytes } from "node:crypto";

import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { inthIntegrations, siteDomains } from "@notra/db/schema";
import {
  decryptToken,
  encryptToken,
} from "@notra/db/utils/integration-encryption";
import { siteAliasHost } from "@notra/sites-core/utils/hosts";
import { and, eq } from "drizzle-orm";

import {
  INTH_ACCESS_TOKEN_REFRESH_BUFFER_MS,
  INTH_API_URL,
  INTH_DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  INTH_OAUTH_REVOKE_URL,
  INTH_OAUTH_TOKEN_URL,
  INTH_PROJECTS_MAX_PAGES,
  INTH_PROJECTS_PAGE_SIZE,
  INTH_REAUTH_ERROR_CODES,
  INTH_REQUEST_TIMEOUT_MS,
} from "./constants/inth";
import { getSitesHostingDomain } from "./env";
import { InthError } from "./errors/sites";
import { readSiteIntegrations, saveSiteC15tBackend } from "./integrations";
import {
  inthProjectListResponseSchema,
  inthProjectResponseSchema,
  inthTokenErrorSchema,
  inthTokenResponseSchema,
} from "./schemas/inth";
import type { SiteIntegrationsState } from "./types/integrations";
import type {
  ExchangeInthAuthorizationCodeParams,
  InthConsentStatus,
  InthIntegrationRow,
  InthOAuthCredentials,
  InthProject,
  InthProjectSummary,
  InthTokens,
  SaveInthIntegrationParams,
} from "./types/inth";
import type { Site } from "./types/sites";
import { withInthProjectLock } from "./utils/inth-project-lock";
import { isRecord } from "./utils/json";

export function getInthOAuthCredentials(): InthOAuthCredentials | null {
  const clientId = process.env.INTH_CLIENT_ID?.trim();
  const clientSecret = process.env.INTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function requireCredentials(): InthOAuthCredentials {
  const credentials = getInthOAuthCredentials();
  if (!credentials) {
    throw new InthError(
      "not_configured",
      "Inth isn't set up on this environment."
    );
  }
  return credentials;
}

export function createInthPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function inthBasicAuth(credentials: InthOAuthCredentials): string {
  const pair = `${encodeURIComponent(credentials.clientId)}:${encodeURIComponent(credentials.clientSecret)}`;
  return `Basic ${Buffer.from(pair).toString("base64")}`;
}

async function requestTokens(
  params: Record<string, string>,
  previousRefreshToken?: string
): Promise<InthTokens> {
  const credentials = requireCredentials();
  const response = await fetch(INTH_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: inthBasicAuth(credentials),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...params, resource: INTH_API_URL }),
    signal: AbortSignal.timeout(INTH_REQUEST_TIMEOUT_MS),
  });
  const payload: unknown = await response.json().catch(() => null);
  const parsed = inthTokenResponseSchema.safeParse(payload);
  if (!(response.ok && parsed.success)) {
    const error = inthTokenErrorSchema.safeParse(payload);
    if (error.success && INTH_REAUTH_ERROR_CODES.has(error.data.error)) {
      throw new InthError(
        "reauth_required",
        "Reconnect Inth to keep managing consent."
      );
    }
    throw new InthError(
      "api_error",
      error.success
        ? (error.data.error_description ?? error.data.error)
        : `Inth token request failed (${response.status})`
    );
  }
  const refreshToken = parsed.data.refresh_token ?? previousRefreshToken;
  if (!refreshToken) {
    throw new InthError(
      "api_error",
      "Inth didn't return a refresh token. Try connecting again."
    );
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken,
    expiresAt: new Date(
      Date.now() +
        (parsed.data.expires_in ?? INTH_DEFAULT_ACCESS_TOKEN_TTL_SECONDS) * 1000
    ),
  };
}

export async function exchangeInthAuthorizationCode(
  params: ExchangeInthAuthorizationCodeParams
): Promise<InthTokens> {
  return await requestTokens({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
}

export async function getInthIntegration(
  organizationId: string
): Promise<InthIntegrationRow | null> {
  const [row] = await db
    .select()
    .from(inthIntegrations)
    .where(eq(inthIntegrations.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

export async function saveInthIntegration(
  params: SaveInthIntegrationParams
): Promise<void> {
  const values = {
    encryptedAccessToken: encryptToken(params.tokens.accessToken),
    encryptedRefreshToken: encryptToken(params.tokens.refreshToken),
    accessTokenExpiresAt: params.tokens.expiresAt,
    status: "active" as const,
  };
  await db
    .insert(inthIntegrations)
    .values({
      id: crypto.randomUUID(),
      organizationId: params.organizationId,
      createdByUserId: params.userId,
      ...values,
    })
    .onConflictDoUpdate({
      target: inthIntegrations.organizationId,
      set: { ...values, createdByUserId: params.userId, updatedAt: new Date() },
    });
}

export async function disconnectInth(organizationId: string): Promise<void> {
  const integration = await getInthIntegration(organizationId);
  if (!integration) {
    return;
  }
  await db
    .delete(inthIntegrations)
    .where(eq(inthIntegrations.id, integration.id));
  const credentials = getInthOAuthCredentials();
  if (!credentials) {
    return;
  }
  await fetch(INTH_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: inthBasicAuth(credentials),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      token: decryptToken(integration.encryptedRefreshToken),
      token_type_hint: "refresh_token",
    }),
    signal: AbortSignal.timeout(INTH_REQUEST_TIMEOUT_MS),
  }).catch((error: unknown) => {
    logError("[Inth] Failed to revoke token", error);
  });
}

async function refreshAccessToken(
  integration: InthIntegrationRow
): Promise<string> {
  try {
    const refreshToken = decryptToken(integration.encryptedRefreshToken);
    const tokens = await requestTokens(
      { grant_type: "refresh_token", refresh_token: refreshToken },
      refreshToken
    );
    const [saved] = await db
      .update(inthIntegrations)
      .set({
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        accessTokenExpiresAt: tokens.expiresAt,
        status: "active",
      })
      .where(
        and(
          eq(inthIntegrations.id, integration.id),
          eq(
            inthIntegrations.encryptedRefreshToken,
            integration.encryptedRefreshToken
          )
        )
      )
      .returning({ id: inthIntegrations.id });
    if (saved) {
      return tokens.accessToken;
    }
    const current = await getInthIntegration(integration.organizationId);
    if (!current || current.status !== "active") {
      throw new InthError("not_connected", "Connect Inth to manage consent.");
    }
    return decryptToken(current.encryptedAccessToken);
  } catch (error) {
    if (error instanceof InthError && error.code === "reauth_required") {
      await db
        .update(inthIntegrations)
        .set({ status: "reauth_required" })
        .where(
          and(
            eq(inthIntegrations.id, integration.id),
            eq(
              inthIntegrations.encryptedRefreshToken,
              integration.encryptedRefreshToken
            )
          )
        );
    }
    throw error;
  }
}

async function requireIntegration(
  organizationId: string
): Promise<InthIntegrationRow> {
  requireCredentials();
  const integration = await getInthIntegration(organizationId);
  if (!integration) {
    throw new InthError("not_connected", "Connect Inth first.");
  }
  if (integration.status === "reauth_required") {
    throw new InthError(
      "reauth_required",
      "Reconnect Inth to keep managing consent."
    );
  }
  return integration;
}

async function inthFetch(
  integration: InthIntegrationRow,
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const expiresSoon =
    integration.accessTokenExpiresAt.getTime() -
      INTH_ACCESS_TOKEN_REFRESH_BUFFER_MS <
    Date.now();
  const send = (accessToken: string) =>
    fetch(`${INTH_API_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(INTH_REQUEST_TIMEOUT_MS),
    });
  let response = await send(
    expiresSoon
      ? await refreshAccessToken(integration)
      : decryptToken(integration.encryptedAccessToken)
  );
  if (response.status === 401 && !expiresSoon) {
    response = await send(await refreshAccessToken(integration));
  }
  if (response.status === 404) {
    throw new InthError(
      "project_not_found",
      "That Inth project doesn't exist or this connection can't reach it."
    );
  }
  if (!response.ok) {
    throw new InthError(
      "api_error",
      `Inth answered ${response.status} for ${path}.`
    );
  }
  return await response.json();
}

function summarizeProject(project: InthProject): InthProjectSummary {
  return {
    id: project.id,
    name: project.name,
    organizationSlug: project.organizationSlug,
    dashboardUrl: project.dashboardUrl,
    backendUrl: project.consent?.backendUrl ?? null,
  };
}

async function listProjects(
  integration: InthIntegrationRow
): Promise<InthProject[]> {
  const projects: InthProject[] = [];
  let cursor: string | null | undefined;
  for (let page = 0; page < INTH_PROJECTS_MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      limit: String(INTH_PROJECTS_PAGE_SIZE),
    });
    if (cursor) {
      query.set("cursor", cursor);
    }
    const parsed = inthProjectListResponseSchema.safeParse(
      await inthFetch(integration, `/v1/projects?${query}`)
    );
    if (!parsed.success) {
      throw new InthError(
        "api_error",
        "Inth returned an unexpected project list."
      );
    }
    projects.push(...parsed.data.data);
    cursor = parsed.data.pagination?.nextCursor;
    if (!cursor) {
      break;
    }
  }
  return projects;
}

async function getProject(
  integration: InthIntegrationRow,
  projectId: string
): Promise<InthProject> {
  const parsed = inthProjectResponseSchema.safeParse(
    await inthFetch(
      integration,
      `/v1/projects/${encodeURIComponent(projectId)}`
    )
  );
  if (!parsed.success) {
    throw new InthError("api_error", "Inth returned an unexpected project.");
  }
  return parsed.data.data;
}

export async function listInthProjects(
  organizationId: string
): Promise<InthProjectSummary[]> {
  const integration = await requireIntegration(organizationId);
  return (await listProjects(integration)).map(summarizeProject);
}

async function siteConsentOrigins(site: Site): Promise<string[]> {
  const domains = await db
    .select({ hostname: siteDomains.hostname })
    .from(siteDomains)
    .where(
      and(eq(siteDomains.siteId, site.id), eq(siteDomains.status, "active"))
    );
  return [
    ...new Set([
      new URL(site.publicOrigin).host,
      siteAliasHost(site.slug, getSitesHostingDomain()),
      ...domains.map((domain) => domain.hostname),
    ]),
  ];
}

function missingOrigins(project: InthProject, origins: string[]): string[] {
  const allowed = project.websites.map((website) => website.origin);
  return origins.filter(
    (origin) =>
      !allowed.some(
        (pattern) =>
          pattern === "*" ||
          pattern === origin ||
          (pattern.startsWith("*.") && origin.endsWith(pattern.slice(1)))
      )
  );
}

async function currentBackendUrl(
  site: Site,
  branch?: string
): Promise<string | null> {
  const { integrations } = await readSiteIntegrations(site, branch);
  const c15t = integrations.c15t;
  return isRecord(c15t) && typeof c15t.backendURL === "string"
    ? c15t.backendURL.replace(/\/+$/, "")
    : null;
}

export async function getInthConsentStatus(
  site: Site,
  branch?: string
): Promise<InthConsentStatus> {
  const empty = { project: null, missingOrigins: [] };
  if (!getInthOAuthCredentials()) {
    return {
      configured: false,
      connected: false,
      reauthRequired: false,
      ...empty,
    };
  }
  const integration = await getInthIntegration(site.organizationId);
  if (!integration) {
    return {
      configured: true,
      connected: false,
      reauthRequired: false,
      ...empty,
    };
  }
  if (integration.status === "reauth_required") {
    return {
      configured: true,
      connected: true,
      reauthRequired: true,
      ...empty,
    };
  }
  const backendUrl = await currentBackendUrl(site, branch);
  try {
    const project = backendUrl
      ? (await listProjects(integration)).find(
          (candidate) =>
            candidate.consent?.backendUrl?.replace(/\/+$/, "") === backendUrl
        )
      : undefined;
    return {
      configured: true,
      connected: true,
      reauthRequired: false,
      project: project ? summarizeProject(project) : null,
      missingOrigins: project
        ? missingOrigins(project, await siteConsentOrigins(site))
        : [],
    };
  } catch (error) {
    if (error instanceof InthError && error.code === "reauth_required") {
      return {
        configured: true,
        connected: true,
        reauthRequired: true,
        ...empty,
      };
    }
    throw error;
  }
}

export async function connectSiteToInthProject(
  site: Site,
  projectId: string,
  userId: string,
  branch?: string
): Promise<SiteIntegrationsState> {
  const integration = await requireIntegration(site.organizationId);
  const origins = await siteConsentOrigins(site);
  const backendUrl = await withInthProjectLock(projectId, async () => {
    const project = await getProject(integration, projectId);
    const url = project.consent?.backendUrl;
    if (!url) {
      throw new InthError(
        "no_backend",
        "This Inth project has no consent backend yet. Turn on Consent for it in Inth first."
      );
    }
    const missing = missingOrigins(project, origins);
    if (missing.length > 0) {
      await inthFetch(
        integration,
        `/v1/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            websites: [
              ...project.websites.map((website) => website.origin),
              ...missing,
            ],
          }),
        }
      );
    }
    return url;
  });
  return await saveSiteC15tBackend(site, backendUrl, userId, branch);
}
