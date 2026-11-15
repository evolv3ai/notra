import { timingSafeEqual } from "node:crypto";

import {
  extractBearerToken,
  localDev,
  type VercelSubjectEnvironment,
  vercelSubject,
  verifyVercelOidc,
} from "eve/channels/auth";

import { ALLOWED_VERCEL_ENVIRONMENTS } from "@/constants/internal-auth";
import { isCrossOriginBrowserRequest } from "@/utils/local-dev-auth";

function matchesInternalWorkflowSecret(token: string | null): boolean {
  const secret = process.env.INTERNAL_WORKFLOW_SECRET;
  if (!(secret && token)) {
    return false;
  }
  const expected = Buffer.from(secret);
  const provided = Buffer.from(token);
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}

function getApiEnvironment(): VercelSubjectEnvironment {
  const configured = process.env.API_VERCEL_ENVIRONMENT;
  const match = ALLOWED_VERCEL_ENVIRONMENTS.find(
    (value) => value === configured
  );
  return match ?? "production";
}

export async function verifyInternalWorkflowRequest(
  request: Request
): Promise<boolean> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (matchesInternalWorkflowSecret(token)) {
    return true;
  }

  const teamSlug = process.env.DASHBOARD_VERCEL_TEAM_SLUG;
  const projectName = process.env.API_VERCEL_PROJECT_NAME;
  if (teamSlug && projectName) {
    const result = await verifyVercelOidc(token, {
      subjects: [
        vercelSubject({
          environment: getApiEnvironment(),
          projectName,
          teamSlug,
        }),
      ],
    });
    if (result.ok) {
      return true;
    }
  }

  // eve's localDev() trusts the request hostname, which comes from the Host
  // header, so it is only safe on a local dev server. Every deployed runtime
  // (Vercel, Unkey) must authenticate with the secret or OIDC.
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  // A page in the developer's browser can reach loopback too; internal
  // callers are server-side and never send browser origin headers.
  if (isCrossOriginBrowserRequest(request)) {
    return false;
  }

  const localAuth = await localDev()(request);
  return localAuth !== null;
}
