import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { prepareOutput } from "./output.mjs";

export async function readConfig(args) {
  const { values } = parseArgs({
    args,
    options: {
      "webhook-url": { type: "string" },
      "callback-url": { type: "string" },
      "setup-url": { type: "string" },
      output: { type: "string" },
      organization: { type: "string" },
      port: { type: "string", default: "8789" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    return null;
  }
  for (const name of ["webhook-url", "callback-url", "setup-url"]) {
    if (!values[name]) {
      throw new Error(`Missing --${name}; supply the discovered dashboard URL`);
    }
    const url = new URL(values[name]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      !url.hostname.includes(".") ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname) ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local")
    ) {
      throw new Error(
        `--${name} must be a public HTTPS URL without credentials or query`
      );
    }
  }
  const webhook = new URL(values["webhook-url"]);
  const callback = new URL(values["callback-url"]);
  const setup = new URL(values["setup-url"]);
  if (webhook.pathname !== "/api/webhooks/github/app") {
    throw new Error("Webhook path must be /api/webhooks/github/app");
  }
  if (
    callback.pathname !== "/api/integrations/github/callback" ||
    setup.pathname !== callback.pathname ||
    setup.origin !== callback.origin
  ) {
    throw new Error(
      "Callback and setup must use the dashboard's /api/integrations/github/callback"
    );
  }
  const port = Number(values.port);
  if (
    !/^\d+$/.test(values.port) ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  ) {
    throw new Error("Port must be an integer from 1024 to 65535");
  }
  if (
    values.organization &&
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(values.organization)
  ) {
    throw new Error("Invalid GitHub organization name");
  }
  return {
    port,
    webhookUrl: webhook.href,
    callbackUrl: callback.href,
    setupUrl: setup.href,
    organization: values.organization,
    name: `notra-sites-e2e-${randomBytes(6).toString("hex")}`,
    output: await prepareOutput(
      values.output ??
        join(homedir(), ".capy/work/notra-sites-e2e/github-app.env")
    ),
  };
}
