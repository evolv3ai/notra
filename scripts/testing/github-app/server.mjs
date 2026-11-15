import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import {
  API_HEADERS,
  FLOW_TTL_MS,
  REPOSITORY_PERMISSIONS,
  WEBHOOK_EVENTS,
} from "./constants/manifest.mjs";
import { validateConversion } from "./schemas/conversion.mjs";
import { readConfig } from "./utils/config.mjs";
import { writeAppEnv } from "./utils/output.mjs";

export async function createSetupServer(
  config,
  { fetchImpl = fetch, now = Date.now } = {}
) {
  const ui = await readFile(new URL("ui.html", import.meta.url), "utf8");
  const scriptHash = createHash("sha256")
    .update(ui.split("<script>")[1].split("</script>")[0])
    .digest("base64");
  const origin = `http://127.0.0.1:${config.port}`;
  const launchToken = randomBytes(32).toString("hex");
  const launchExpires = now() + FLOW_TTL_MS;
  let flow = null;
  let completed = null;

  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'self'; form-action https://github.com; frame-ancestors 'none'; base-uri 'none'`
    );
    const send = (status, body, type = "text/plain; charset=utf-8") => {
      response.writeHead(status, { "Content-Type": type });
      response.end(body);
    };
    try {
      if (request.headers.host !== new URL(origin).host) {
        return send(403, "Forbidden host");
      }
      const url = new URL(request.url, origin);
      if (url.origin !== origin) {
        return send(403, "Forbidden origin");
      }
      const requestOrigin = request.headers.origin;
      if (
        requestOrigin &&
        requestOrigin !== origin &&
        !(
          url.pathname === "/callback" && requestOrigin === "https://github.com"
        )
      ) {
        return send(403, "Forbidden origin");
      }
      if (url.pathname === "/" && request.method === "GET" && !url.search) {
        return send(200, ui, "text/html; charset=utf-8");
      }
      if (
        url.pathname === "/bootstrap" &&
        request.method === "POST" &&
        !url.search
      ) {
        const supplied = request.headers["x-setup-token"];
        if (
          requestOrigin !== origin ||
          (request.headers["sec-fetch-site"] &&
            request.headers["sec-fetch-site"] !== "same-origin") ||
          typeof supplied !== "string" ||
          supplied.length !== launchToken.length ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(launchToken)) ||
          now() >= launchExpires ||
          flow
        ) {
          return send(
            403,
            "Invalid or already used launch token; restart the helper"
          );
        }
        flow = {
          state: randomBytes(32).toString("hex"),
          session: randomBytes(32).toString("hex"),
          expires: now() + FLOW_TTL_MS,
          used: false,
        };
        response.setHeader(
          "Set-Cookie",
          `notra_manifest=${flow.session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`
        );
        const manifest = {
          name: config.name,
          url: new URL(config.callbackUrl).origin,
          description:
            "Disposable Notra Sites E2E test app. Install on the test repository only.",
          hook_attributes: { url: config.webhookUrl, active: true },
          redirect_url: `${origin}/callback`,
          callback_urls: [config.callbackUrl],
          setup_url: config.setupUrl,
          setup_on_update: true,
          public: false,
          request_oauth_on_install: false,
          default_permissions: REPOSITORY_PERMISSIONS,
          default_events: WEBHOOK_EVENTS,
        };
        const registrationPath = config.organization
          ? `/organizations/${config.organization}/settings/apps/new`
          : "/settings/apps/new";
        return send(
          200,
          JSON.stringify({
            action: `https://github.com${registrationPath}?state=${flow.state}`,
            manifest,
          }),
          "application/json; charset=utf-8"
        );
      }
      if (url.pathname === "/callback" && request.method === "GET") {
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const session = request.headers.cookie
          ?.split(";")
          .map((part) => part.trim())
          .includes(`notra_manifest=${flow?.session}`);
        if (
          !flow ||
          flow.used ||
          now() >= flow.expires ||
          !session ||
          !state ||
          !/^[a-f0-9]{64}$/.test(state) ||
          !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state)) ||
          url.searchParams.getAll("state").length !== 1 ||
          url.searchParams.getAll("code").length !== 1 ||
          !code ||
          !/^[a-zA-Z0-9_-]{1,256}$/.test(code) ||
          url.searchParams.has("error") ||
          (request.headers["sec-fetch-mode"] &&
            request.headers["sec-fetch-mode"] !== "navigate") ||
          (request.headers["sec-fetch-dest"] &&
            request.headers["sec-fetch-dest"] !== "document")
        ) {
          return send(
            403,
            "Invalid, expired, or already used manifest callback"
          );
        }
        flow.used = true;
        try {
          const result = await fetchImpl(
            `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
            {
              method: "POST",
              headers: API_HEADERS,
              redirect: "error",
              signal: AbortSignal.timeout(30_000),
            }
          );
          if (result.status !== 201) {
            throw new Error("Manifest conversion failed");
          }
          const env = validateConversion(await result.json());
          await writeAppEnv(config.output, env);
          completed = { ok: true };
        } catch {
          completed = { ok: false };
        }
        response.writeHead(303, { Location: "/done" });
        return response.end();
      }
      if (url.pathname === "/done" && request.method === "GET" && !url.search) {
        const session = request.headers.cookie
          ?.split(";")
          .map((part) => part.trim())
          .includes(`notra_manifest=${flow?.session}`);
        if (!session || !completed) {
          return send(403, "No completed setup in this browser");
        }
        return send(
          completed.ok ? 200 : 502,
          completed.ok
            ? '<!doctype html><html lang="en"><meta charset="utf-8"><title>GitHub App saved</title><h1>GitHub App saved securely</h1><p>The four app env values were written to the new output file with mode 0600. No secrets are shown here.</p><p>Have the operator load that file into the E2E dashboard server and restart it. Then use the dashboard’s GitHub / Sites connection flow, select <strong>Only select repositories</strong>, and choose only the disposable test repository.</p><p>Do not install on all repositories. You confirm creation and installation on GitHub yourself.</p></html>'
            : '<!doctype html><html lang="en"><meta charset="utf-8"><title>Setup failed</title><h1>Setup failed</h1><p>Conversion or secure persistence failed. The callback has been consumed; restart the helper with a new output file. If GitHub already created an app, review and delete the incomplete test app in GitHub settings before trying again.</p></html>',
          "text/html; charset=utf-8"
        );
      }
      return send(404, "Not found");
    } catch {
      return send(500, "Setup request failed");
    }
  });
  server.requestTimeout = 35_000;
  server.headersTimeout = 10_000;
  return { server, launchUrl: `${origin}/#${launchToken}` };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const config = await readConfig(process.argv.slice(2));
    if (!config) {
      console.log(
        "Usage: node scripts/testing/github-app/server.mjs --webhook-url HTTPS_URL --callback-url HTTPS_URL --setup-url HTTPS_URL [--output NEW_UNTRACKED_FILE] [--organization OWNER] [--port 8789]"
      );
    } else {
      const { server, launchUrl } = await createSetupServer(config);
      server.on("error", () => {
        console.error(
          "Cannot start localhost helper; check the port and restart."
        );
        process.exitCode = 1;
      });
      server.listen(config.port, "127.0.0.1", () => {
        console.log(
          `Open this private, single-use local setup link: ${launchUrl}`
        );
        console.log(
          `Output: ${config.output} (new file, mode 0600). No app is created until you confirm on GitHub.`
        );
      });
    }
  } catch {
    console.error(
      "Invalid setup options or unsafe output. Run with --help; supply public URLs and a new dedicated untracked env file."
    );
    process.exitCode = 1;
  }
}
