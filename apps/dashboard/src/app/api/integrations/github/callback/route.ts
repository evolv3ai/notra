import {
  GitHubAccountRequiredError,
  GitHubInstallationAccessDeniedError,
  GitHubReauthorizationRequiredError,
  upsertGitHubAppInstallation,
} from "@notra/ai/integrations/github";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { buildCallbackUrl } from "@notra/utils/callback-url";
import { ORPCError } from "@orpc/server";
import { getCookie } from "@tanstack/react-start/server";

import {
  INTEGRATION_AUTH_KINDS,
  INTEGRATION_PROVIDERS,
} from "@/constants/integration-analytics";
import { redirectResponse } from "@/lib/auth/http";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { getServerSession } from "@/lib/auth/session";
import {
  trackIntegrationConnected,
  trackIntegrationConnectFailed,
} from "@/lib/integrations/connect-events";
import { getLastVisitedOrganization } from "@/utils/cookies";
import { ratelimit } from "@/utils/ratelimit";

interface GitHubAppInstallState {
  organizationId: string;
  userId: string;
  callbackPath: string;
}

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9-]+$/i;

function getFallbackCallbackPath() {
  const slug = getLastVisitedOrganization({
    get: (name) => {
      const value = getCookie(name);
      return value === undefined ? undefined : { value };
    },
  });
  if (!slug || !ORGANIZATION_SLUG_PATTERN.test(slug)) {
    return null;
  }
  return `/${slug}/integrations/github`;
}

async function readInstallState(
  state: string | null
): Promise<GitHubAppInstallState | null> {
  if (!(state && redis)) {
    return null;
  }

  const raw = await redis.get<string>(`github_app_install:${state}`);
  if (!raw) {
    return null;
  }

  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function GET(request: Request) {
  const baseUrl = getAppUrl() ?? "";
  let callbackPath: string | null = null;
  let installationId: string | null = null;
  let state: string | null = null;
  const fail = (code: string) => {
    trackIntegrationConnectFailed({
      headers: request.headers,
      provider: INTEGRATION_PROVIDERS.GITHUB,
      authKind: INTEGRATION_AUTH_KINDS.OAUTH,
      errorCode: code,
    });
    return redirectResponse(
      callbackPath
        ? buildCallbackUrl(baseUrl, callbackPath, { githubError: code })
        : `${baseUrl}/?error=${encodeURIComponent(code)}`
    );
  };

  try {
    const { searchParams } = new URL(request.url);
    installationId = searchParams.get("installation_id");
    state = searchParams.get("state");
    const error = searchParams.get("error");

    const installState = await readInstallState(state);
    callbackPath = installState?.callbackPath ?? getFallbackCallbackPath();

    if (error) {
      return fail(
        error === "access_denied"
          ? "install_cancelled"
          : "github_callback_failed"
      );
    }

    if (!(installationId && state && redis)) {
      return fail("invalid_callback");
    }

    if (!installState) {
      return fail("expired_state");
    }

    const { session, user } = await getServerSession({
      headers: request.headers,
    });
    if (!session?.userId || session.userId !== installState.userId) {
      return fail("session_mismatch");
    }

    const { success: withinLimit } = await ratelimit.githubAppCallback.limit(
      session.userId
    );
    if (!withinLimit) {
      return fail("too_many_requests");
    }

    try {
      await assertOrganizationAccess({
        headers: request.headers,
        organizationId: installState.organizationId,
        user,
      });
    } catch (accessError) {
      if (accessError instanceof ORPCError) {
        return fail("forbidden");
      }
      throw accessError;
    }

    const installation = await upsertGitHubAppInstallation({
      organizationId: installState.organizationId,
      userId: installState.userId,
      installationId,
    });

    trackIntegrationConnected({
      headers: request.headers,
      userId: installState.userId,
      organizationId: installState.organizationId,
      provider: INTEGRATION_PROVIDERS.GITHUB,
      authKind: INTEGRATION_AUTH_KINDS.OAUTH,
    });

    return redirectResponse(
      buildCallbackUrl(baseUrl, installState.callbackPath, {
        githubConnected: "true",
        githubAccountId: installation.accountId,
      })
    );
  } catch (error) {
    if (
      error instanceof GitHubAccountRequiredError ||
      error instanceof GitHubReauthorizationRequiredError
    ) {
      if (callbackPath && installationId && state) {
        return redirectResponse(
          buildCallbackUrl(baseUrl, callbackPath, {
            githubReauthorizeInstallationId: installationId,
            githubReauthorizeState: state,
          })
        );
      }
      return fail("github_reauthorization_required");
    }
    if (error instanceof GitHubInstallationAccessDeniedError) {
      return fail("github_installation_forbidden");
    }
    logError("Error in GitHub App callback", error);
    return fail("github_callback_failed");
  }
}
