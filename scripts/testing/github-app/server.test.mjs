import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { request } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FLOW_TTL_MS } from "./constants/manifest.mjs";
import { createSetupServer } from "./server.mjs";
import { readConfig } from "./utils/config.mjs";
import { prepareOutput } from "./utils/output.mjs";

const pem = generateKeyPairSync("rsa", {
  modulusLength: 2048,
}).privateKey.export({ type: "pkcs1", format: "pem" });
const apiData = {
  id: 12345,
  slug: "notra-sites-e2e-test",
  pem,
  webhook_secret: "fake-webhook-secret-123456",
  client_secret: "fake-client-secret-never-render",
};
const origin = "http://127.0.0.1:8789";

async function fixture(
  t,
  conversion = () => Response.json(apiData, { status: 201 })
) {
  const scratch = join(homedir(), ".capy/work/notra-sites-e2e");
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(scratch, { recursive: true })
  );
  const directory = await mkdtemp(join(scratch, "helper-test-"));
  const output = join(directory, "github-app.env");
  let calls = 0;
  let time = 1_000;
  const { server, launchUrl } = await createSetupServer(
    {
      port: 8789,
      webhookUrl: "https://test-dashboard.example/api/webhooks/github/app",
      callbackUrl:
        "https://test-dashboard.example/api/integrations/github/callback",
      setupUrl:
        "https://test-dashboard.example/api/integrations/github/callback",
      name: "notra-sites-e2e-fixture",
      output,
    },
    {
      now: () => time,
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(
          url,
          "https://api.github.com/app-manifests/test-temporary-code/conversions"
        );
        assert.equal(options.method, "POST");
        assert.equal(options.redirect, "error");
        assert.equal(options.headers.Authorization, undefined);
        return conversion();
      },
    }
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const call = (path, { method = "GET", headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: server.address().port,
          path,
          method,
          headers: { Host: "127.0.0.1:8789", ...headers },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString(),
            })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });
  const bootstrap = async () => {
    const result = await call("/bootstrap", {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Setup-Token": new URL(launchUrl).hash.slice(1),
        "Sec-Fetch-Site": "same-origin",
      },
    });
    assert.equal(result.status, 200);
    const data = JSON.parse(result.body);
    return {
      ...data,
      state: new URL(data.action).searchParams.get("state"),
      cookie: result.headers["set-cookie"][0].split(";")[0],
    };
  };
  return {
    call,
    bootstrap,
    output,
    token: new URL(launchUrl).hash.slice(1),
    calls: () => calls,
    advance: (ms) => {
      time += ms;
    },
  };
}

test("bootstrap requires exact Host, local Origin, launch proof and one use", async (t) => {
  const f = await fixture(t);
  for (const headers of [
    { Host: "evil.example", Origin: origin, "X-Setup-Token": f.token },
    { Host: "localhost:8789", Origin: origin, "X-Setup-Token": f.token },
    { Origin: "https://evil.example", "X-Setup-Token": f.token },
    { "X-Setup-Token": f.token },
    { Origin: "null", "X-Setup-Token": f.token },
    { Origin: origin },
    { Origin: origin, "X-Setup-Token": "0".repeat(64) },
    {
      Origin: origin,
      "X-Setup-Token": f.token,
      "Sec-Fetch-Site": "cross-site",
    },
  ]) {
    assert.equal(
      (await f.call("/bootstrap", { method: "POST", headers })).status,
      403
    );
  }
  assert.equal((await f.call("/bootstrap")).status, 404);
  const setup = await f.bootstrap();
  assert.equal(setup.manifest.public, false);
  assert.deepEqual(setup.manifest.default_permissions, {
    contents: "write",
    pull_requests: "write",
    checks: "write",
    metadata: "read",
  });
  assert.deepEqual(setup.manifest.default_events, [
    "push",
    "pull_request",
    "check_run",
  ]);
  assert.equal(setup.manifest.redirect_url, `${origin}/callback`);
  assert.equal(
    (
      await f.call("/bootstrap", {
        method: "POST",
        headers: { Origin: origin, "X-Setup-Token": f.token },
      })
    ).status,
    403
  );
  assert.equal(f.calls(), 0);
});

test("missing, mismatched, malformed state and unauthenticated/cross-site callbacks cannot convert", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.call("/callback?code=test-temporary-code&state=missing")).status,
    403
  );
  const setup = await f.bootstrap();
  const valid = `/callback?code=test-temporary-code&state=${setup.state}`;
  for (const [path, headers] of [
    ["/callback?code=test-temporary-code", { Cookie: setup.cookie }],
    [
      "/callback?code=test-temporary-code&state=wrong",
      { Cookie: setup.cookie },
    ],
    [
      `/callback?code=test-temporary-code&state=${"0".repeat(64)}`,
      { Cookie: setup.cookie },
    ],
    [valid, {}],
    [valid, { Cookie: "notra_manifest=wrong" }],
    [valid, { Cookie: setup.cookie, Host: "evil.example" }],
    [valid, { Cookie: setup.cookie, Origin: "https://evil.example" }],
    [
      valid,
      { Cookie: setup.cookie, Origin: "https://github.com.evil.example" },
    ],
    [valid, { Cookie: setup.cookie, "Sec-Fetch-Mode": "cors" }],
    [valid, { Cookie: setup.cookie, "Sec-Fetch-Dest": "iframe" }],
    [`${valid}&state=duplicate`, { Cookie: setup.cookie }],
    [`${valid}&code=duplicate`, { Cookie: setup.cookie }],
    [`${valid}&error=secret-error`, { Cookie: setup.cookie }],
    [
      `/callback?code=bad%2Fcode&state=${setup.state}`,
      { Cookie: setup.cookie },
    ],
  ]) {
    const result = await f.call(path, { headers });
    assert.equal(result.status, 403);
    assert.ok(!result.body.includes("test-temporary-code"));
  }
  assert.equal(f.calls(), 0);
  await assert.rejects(stat(f.output), { code: "ENOENT" });
});

test("launch and callback expire within one hour", async (t) => {
  const f = await fixture(t);
  const setup = await f.bootstrap();
  f.advance(FLOW_TTL_MS);
  assert.equal(
    (
      await f.call(`/callback?code=test-temporary-code&state=${setup.state}`, {
        headers: { Cookie: setup.cookie },
      })
    ).status,
    403
  );
  assert.equal(f.calls(), 0);
  const expired = await fixture(t);
  expired.advance(FLOW_TTL_MS);
  assert.equal(
    (
      await expired.call("/bootstrap", {
        method: "POST",
        headers: { Origin: origin, "X-Setup-Token": expired.token },
      })
    ).status,
    403
  );
});

test("conversion saves only consumed env values with 0600; replay never converts or renders secrets", async (t) => {
  const f = await fixture(t);
  const ui = await f.call("/");
  assert.equal(ui.status, 200);
  assert.equal(ui.headers["referrer-policy"], "no-referrer");
  assert.equal(ui.headers["cache-control"], "no-store");
  const hash = createHash("sha256")
    .update(ui.body.split("<script>")[1].split("</script>")[0])
    .digest("base64");
  assert.ok(ui.headers["content-security-policy"].includes(`'sha256-${hash}'`));
  const setup = await f.bootstrap();
  const path = `/callback?code=test-temporary-code&state=${setup.state}`;
  const result = await f.call(path, {
    headers: {
      Cookie: setup.cookie,
      Origin: "https://github.com",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
    },
  });
  assert.equal(result.status, 303);
  assert.equal(result.headers.location, "/done");
  assert.equal(f.calls(), 1);
  assert.equal((await stat(f.output)).mode & 0o777, 0o600);
  const saved = await readFile(f.output, "utf8");
  assert.equal(saved.split("\n").filter(Boolean).length, 4);
  assert.ok(saved.includes(`GITHUB_APP_PRIVATE_KEY=${JSON.stringify(pem)}`));
  assert.ok(!saved.includes("client_secret"));
  assert.equal(
    (await f.call(path, { headers: { Cookie: setup.cookie } })).status,
    403
  );
  assert.equal(f.calls(), 1);
  const done = await f.call("/done", { headers: { Cookie: setup.cookie } });
  assert.equal(done.status, 200);
  assert.equal((await f.call("/done")).status, 403);
  for (const body of [ui.body, JSON.stringify(setup), result.body, done.body]) {
    for (const secret of [
      pem,
      apiData.webhook_secret,
      apiData.client_secret,
      "test-temporary-code",
    ]) {
      assert.ok(!body.includes(secret));
    }
  }
});

test("API errors, malformed JSON, invalid secrets and fetch failures consume state without persistence or leakage", async (t) => {
  for (const conversion of [
    () => Response.json({ message: apiData.client_secret }, { status: 422 }),
    () => Response.json(apiData, { status: 200 }),
    () => new Response(`not-json-${apiData.webhook_secret}`, { status: 201 }),
    () =>
      Response.json({ ...apiData, pem: "-----BEGIN INVALID" }, { status: 201 }),
    () =>
      Response.json(
        { ...apiData, webhook_secret: "bad\nINJECTED=value" },
        { status: 201 }
      ),
    () => Response.json({ ...apiData, id: -1 }, { status: 201 }),
    () => Response.json({ ...apiData, slug: "<script>" }, { status: 201 }),
    () => {
      throw new Error(apiData.client_secret);
    },
  ]) {
    const f = await fixture(t, conversion);
    const setup = await f.bootstrap();
    const path = `/callback?code=test-temporary-code&state=${setup.state}`;
    assert.equal(
      (await f.call(path, { headers: { Cookie: setup.cookie } })).status,
      303
    );
    const done = await f.call("/done", { headers: { Cookie: setup.cookie } });
    assert.equal(done.status, 502);
    assert.ok(!done.body.includes(apiData.client_secret));
    assert.ok(!done.body.includes(apiData.webhook_secret));
    await assert.rejects(stat(f.output), { code: "ENOENT" });
    assert.equal(
      (await f.call(path, { headers: { Cookie: setup.cookie } })).status,
      403
    );
    assert.equal(f.calls(), 1);
  }
});

test("output refuses existing files, symlinks, main .env and deleted tracked files", async (t) => {
  const f = await fixture(t);
  const directory = join(f.output, "..");
  await writeFile(f.output, "existing", { mode: 0o644 });
  await assert.rejects(prepareOutput(f.output));
  assert.equal(await readFile(f.output, "utf8"), "existing");
  const link = join(directory, "link.env");
  await symlink(f.output, link);
  await assert.rejects(prepareOutput(link));
  await assert.rejects(prepareOutput(join(directory, ".env")));
  execFileSync("git", ["init", "-q", directory]);
  const tracked = join(directory, "tracked.env");
  await writeFile(tracked, "nonsecret-fixture");
  execFileSync("git", ["-C", directory, "add", "tracked.env"]);
  await rm(tracked);
  await assert.rejects(prepareOutput(tracked));
  const setup = await f.bootstrap();
  await f.call(`/callback?code=test-temporary-code&state=${setup.state}`, {
    headers: { Cookie: setup.cookie },
  });
  assert.equal(
    (await f.call("/done", { headers: { Cookie: setup.cookie } })).status,
    502
  );
  assert.equal(await readFile(f.output, "utf8"), "existing");
});

test("CLI requires discovered URLs, new output and supports organization manifests", async (t) => {
  const f = await fixture(t);
  const args = [
    "--webhook-url",
    "https://test-dashboard.example/api/webhooks/github/app",
    "--callback-url",
    "https://test-dashboard.example/api/integrations/github/callback",
    "--setup-url",
    "https://test-dashboard.example/api/integrations/github/callback",
    "--output",
    f.output,
    "--organization",
    "test-org",
  ];
  const config = await readConfig(args);
  assert.match(config.name, /^notra-sites-e2e-[a-f0-9]{12}$/);
  assert.equal(config.organization, "test-org");
  await assert.rejects(readConfig([]));
  for (const [flag, value] of [
    ["--webhook-url", "http://localhost:3000/api/webhooks/github/app"],
    ["--callback-url", "https://test-dashboard.example/wrong"],
    [
      "--setup-url",
      "https://different.example/api/integrations/github/callback",
    ],
    ["--port", "0"],
    ["--organization", "../bad"],
  ]) {
    const changed = [...args];
    const index = changed.indexOf(flag);
    if (index === -1) {
      changed.push(flag, value);
    } else {
      changed[index + 1] = value;
    }
    await assert.rejects(readConfig(changed));
  }
  assert.equal(await readConfig(["--help"]), null);
});
