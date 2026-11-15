import { randomUUID } from "node:crypto";

import { EmulatorError, startEmulator } from "../core/service";
import type { DnsZone } from "../dns/zone";
import type { CloudflareEmulatorOptions, CustomHostname } from "./types";

const envelope = (result: unknown, status = 200) =>
  Response.json(
    { success: status < 400, errors: [], messages: [], result },
    { status }
  );

// Cloudflare for SaaS custom hostnames. A hostname stays pending until the
// shared DNS zone has its CNAME to the SaaS target and Cloudflare's ownership
// TXT, as on the real edge; then hostname and certificate turn active (HTTP
// DCV needs no extra record once the CNAME points at Cloudflare).
export async function startCloudflareEmulator(
  options: CloudflareEmulatorOptions,
  zone: DnsZone
) {
  const hostnames = new Map<string, CustomHostname>();
  const authorize = (request: Request, zoneId: string | undefined) => {
    if (request.headers.get("authorization") !== `Bearer ${options.apiToken}`) {
      throw new EmulatorError(403, "Authentication error");
    }
    if (zoneId !== options.zoneId) {
      throw new EmulatorError(404, `Unknown zone ${zoneId}`);
    }
  };
  const refresh = (custom: CustomHostname) => {
    const routed = zone.has(custom.hostname, "CNAME", options.cnameTarget);
    const owned = zone.has(
      custom.ownership_verification.name,
      "TXT",
      custom.ownership_verification.value
    );
    custom.status = routed && owned ? "active" : "pending";
    custom.ssl.status = routed ? "active" : "pending_validation";
    custom.verification_errors = [];
    if (!routed) {
      custom.verification_errors.push(
        `${custom.hostname} does not CNAME to ${options.cnameTarget}`
      );
    } else if (!owned) {
      custom.verification_errors.push(
        "custom hostname ownership TXT record not found"
      );
    }
    return custom;
  };
  const base = "/client/v4/zones/:zone/custom_hostnames";
  const server = await startEmulator("cloudflare", [
    {
      method: "POST",
      path: base,
      handle: async (request, params) => {
        authorize(request, params.zone);
        const body = (await request.json()) as {
          hostname?: string;
          ssl?: { method?: string; type?: string };
        };
        if (!body.hostname) {
          return envelope(null, 400);
        }
        if (
          [...hostnames.values()].some(
            (entry) => entry.hostname === body.hostname
          )
        ) {
          return Response.json(
            {
              success: false,
              errors: [
                { code: 1406, message: "Duplicate custom hostname found." },
              ],
              result: null,
            },
            { status: 409 }
          );
        }
        const custom: CustomHostname = {
          id: randomUUID(),
          hostname: body.hostname,
          status: "pending",
          ownership_verification: {
            type: "txt",
            name: `_cf-custom-hostname.${body.hostname}`,
            value: randomUUID(),
          },
          ssl: {
            status: "initializing",
            method: body.ssl?.method ?? "http",
            type: body.ssl?.type ?? "dv",
            validation_records: [
              {
                http_url: `http://${body.hostname}/.well-known/pki-validation/${randomUUID()}.txt`,
                http_body: randomUUID(),
              },
            ],
          },
          created_at: new Date().toISOString(),
        };
        hostnames.set(custom.id, custom);
        return envelope(custom);
      },
    },
    {
      method: "GET",
      path: base,
      handle: (request, params, url) => {
        authorize(request, params.zone);
        const wanted = url.searchParams.get("hostname");
        return envelope(
          [...hostnames.values()]
            .filter((entry) => !wanted || entry.hostname === wanted)
            .map(refresh)
        );
      },
    },
    {
      method: "GET",
      path: `${base}/:id`,
      handle: (request, params) => {
        authorize(request, params.zone);
        const custom = hostnames.get(params.id ?? "");
        return custom ? envelope(refresh(custom)) : envelope(null, 404);
      },
    },
    {
      method: "DELETE",
      path: `${base}/:id`,
      handle: (request, params) => {
        authorize(request, params.zone);
        const existed = hostnames.delete(params.id ?? "");
        return existed ? envelope({ id: params.id }) : envelope(null, 404);
      },
    },
  ]);
  return {
    ...server,
    hostnames,
    env: {
      SITES_CLOUDFLARE_API_URL: server.url,
      CLOUDFLARE_SAAS_ZONE_ID: options.zoneId,
      CLOUDFLARE_SAAS_API_TOKEN: options.apiToken,
      SITES_CNAME_TARGET: options.cnameTarget,
    },
  };
}
