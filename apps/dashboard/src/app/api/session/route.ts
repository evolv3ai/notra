import { getAuthIdentity, getAuthSession } from "@/lib/auth/server";
import { buildSessionCorsHeaders } from "@/lib/auth/session-cors";
import { syncLocaleCookie } from "@/lib/i18n/locale-cookie";
import { toClientSessionData } from "@/utils/client-session";

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...buildSessionCorsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(request: Request) {
  const headers = buildSessionCorsHeaders(request.headers.get("origin"));
  if (new URL(request.url).searchParams.get("view") === "navbar") {
    const identity = await getAuthIdentity();
    return Response.json({ isAuthenticated: Boolean(identity) }, { headers });
  }

  const data = await getAuthSession();

  if (!data) {
    return Response.json(null, { headers });
  }

  await syncLocaleCookie(data.user.locale);

  const payload = toClientSessionData(data.session, data.user);

  return Response.json(payload, { headers });
}
