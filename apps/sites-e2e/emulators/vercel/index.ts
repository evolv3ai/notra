import { randomUUID } from "node:crypto";

import { EmulatorError, startEmulator } from "../core/service";
import type { DnsZone } from "../dns/zone";
import type { VercelEmulatorOptions, VercelGrant } from "./types";

// The Vercel DNS integration: the user approves the integration
// (`approve()` returns the code Vercel would redirect with), the backend
// exchanges it for a token, writes records into the shared DNS zone and
// removes the installation again.
export async function startVercelEmulator(
  options: VercelEmulatorOptions,
  zone: DnsZone
) {
  const grants: VercelGrant[] = [];
  for (const managed of options.zones) {
    zone.add({
      name: managed,
      type: "NS",
      value: "ns1.vercel-dns.com",
      source: "vercel",
    });
    zone.add({
      name: managed,
      type: "NS",
      value: "ns2.vercel-dns.com",
      source: "vercel",
    });
  }
  const grantFor = (request: Request) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const grant = grants.find(
      (entry) => entry.accessToken === token && !entry.removed
    );
    if (!grant) {
      throw new EmulatorError(403, "Invalid token");
    }
    return grant;
  };
  const server = await startEmulator("vercel", [
    {
      method: "POST",
      path: "/v2/oauth/access_token",
      handle: async (request) => {
        const form = new URLSearchParams(await request.text());
        const grant = grants.find((entry) => entry.code === form.get("code"));
        if (
          form.get("client_id") !== options.clientId ||
          form.get("client_secret") !== options.clientSecret ||
          form.get("redirect_uri") !== options.redirectUri ||
          !grant
        ) {
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        }
        grant.code = `used-${randomUUID()}`;
        return Response.json({
          token_type: "Bearer",
          access_token: grant.accessToken,
          installation_id: grant.configurationId,
          user_id: "emulated-user",
          team_id: grant.teamId,
        });
      },
    },
    {
      method: "POST",
      path: "/v2/domains/:zone/records",
      handle: async (request, params) => {
        grantFor(request);
        if (!options.zones.includes(params.zone ?? "")) {
          return Response.json(
            { error: { code: "not_found" } },
            { status: 404 }
          );
        }
        const body = (await request.json()) as {
          name: string;
          type: "A" | "CNAME" | "TXT";
          value: string;
        };
        const added = zone.add({
          name: body.name ? `${body.name}.${params.zone}` : (params.zone ?? ""),
          type: body.type,
          value: body.value,
          source: "vercel",
        });
        return added
          ? Response.json({ uid: `rec_${randomUUID()}`, updated: Date.now() })
          : Response.json(
              { error: { code: "record_exists" } },
              { status: 409 }
            );
      },
    },
    {
      method: "DELETE",
      path: "/v1/integrations/configuration/:id",
      handle: (request, params) => {
        const grant = grantFor(request);
        if (grant.configurationId !== params.id) {
          return Response.json(
            { error: { code: "not_found" } },
            { status: 404 }
          );
        }
        grant.removed = true;
        return new Response(null, { status: 204 });
      },
    },
  ]);
  return {
    ...server,
    grants,
    env: {
      SITES_VERCEL_API_URL: server.url,
      SITES_VERCEL_INTEGRATION_SLUG: "notra-sites-e2e",
      SITES_VERCEL_CLIENT_ID: options.clientId,
      SITES_VERCEL_CLIENT_SECRET: options.clientSecret,
    },
    /** The user installs the integration; Vercel redirects with this code. */
    approve: (teamId: string | null = null) => {
      const grant: VercelGrant = {
        code: randomUUID(),
        accessToken: `vercel_${randomUUID()}`,
        configurationId: `icfg_${randomUUID().slice(0, 12)}`,
        teamId,
        removed: false,
      };
      grants.push(grant);
      return grant.code;
    },
  };
}
