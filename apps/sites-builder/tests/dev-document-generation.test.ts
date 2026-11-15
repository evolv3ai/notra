import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

import { DEV_HMR_GENERATION_EVENT } from "../compiler/constants/cli";

async function renderProtocol(documentToken?: string) {
  const require = createRequire(new URL("../package.json", import.meta.url));
  const astroRequire = createRequire(require.resolve("astro/package.json"));
  const compiler = astroRequire("@astrojs/compiler-rs");
  const runtimeUrl = pathToFileURL(
    astroRequire.resolve("astro/compiler-runtime")
  ).href;
  const runtime = await import(runtimeUrl);
  const containerUrl = pathToFileURL(
    astroRequire.resolve("astro/container")
  ).href;
  const { experimental_AstroContainer } = await import(containerUrl);
  const source = await readFile(
    new URL("../src/components/DevReload.astro", import.meta.url),
    "utf8"
  );
  const compiled = compiler.transform(source, { filename: "DevReload.astro" });
  expect(compiled.diagnostics).toEqual([]);
  const componentCode = compiled.code.slice(
    compiled.code.indexOf("const $$DevReload ="),
    compiled.code.indexOf("export default $$DevReload;")
  );
  const component = runInNewContext(`${componentCode}\n$$DevReload;`, {
    $$createComponent: runtime.createComponent,
    $$render: runtime.render,
    $$defineScriptVars: runtime.defineScriptVars,
    process: {
      env: {
        NOTRA_DEV_DOCUMENT_TOKEN: documentToken,
        NOTRA_DEV_HMR_EVENT: DEV_HMR_GENERATION_EVENT,
      },
    },
  });
  const container = await experimental_AstroContainer.create();
  return container.renderToString(component);
}

test("rendered HTML owns the shared document generation and reuses Astro's exact native client module", async () => {
  const blog = await renderProtocol("document-session.1");
  const changelog = await renderProtocol("document-session.1");
  const replacement = await renderProtocol("document-session.2");
  for (const html of [blog, changelog]) {
    expect(html).toContain('const renderedToken = "document-session.1";');
    expect(html).toContain('await import("/@vite/client")');
    expect(html).toContain('hot.on("vite:ws:connect", report)');
    expect(html).toContain("hot.send(event, renderedToken)");
    expect(html).toContain("report();");
    expect(html).not.toContain("new WebSocket");
    expect(html).not.toContain("/blog/@vite/client");
    expect(html).not.toContain("/changelog/@vite/client");
  }
  expect(replacement).toContain('const renderedToken = "document-session.2";');
  expect(blog).not.toContain("document-session.2");
});

test("hosted documents omit the dev protocol and the shared layout gates it on development", async () => {
  expect((await renderProtocol()).trim()).toBe("");
  const layout = await readFile(
    new URL("../src/layouts/Base.astro", import.meta.url),
    "utf8"
  );
  expect(layout).toContain(
    "import.meta.env.DEV && process.env.NOTRA_DEV_DOCUMENT_TOKEN && <DevReload />"
  );
});

test("current fallback-client connections reload only their own older document generation", async () => {
  const root = await mkdtemp(join(tmpdir(), "notra-document-generation-"));
  const paramsPath = join(root, "params.json");
  await writeFile(
    paramsPath,
    JSON.stringify({
      config: {},
      workDir: root,
      area: "blog",
      mount: "/blog",
      publicOrigin: "http://localhost:4321",
    })
  );
  const configPath = fileURLToPath(
    new URL("../astro.config.mjs", import.meta.url)
  );
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `const { default: config } = await import(${JSON.stringify(configPath)});
const plugin = config.vite.plugins.find((plugin) => plugin.name === 'notra-dev-hmr');
const listeners = new Map();
let broadcasts = 0;
const resolved = {};
plugin.configResolved(resolved);
plugin.configureServer({ ws: { on: (event, listener) => listeners.set(event, listener), send: () => { broadcasts += 1; } } });
const handler = listeners.get(process.env.NOTRA_DEV_HMR_EVENT);
const cases = ['document-session.1', 'document-session.2', 'document-session.3', 'other-session.1', '', 'document-session', 'document-session.0', 'document-session.-1', 'document-session.01', 'document-session.1.0', 'document-session.1e0', 'document-session.1.5', 'document-session.Infinity', 'document-session.9007199254740992', null, {}, []];
const results = cases.map((token) => {
  const sent = [];
  handler(token, { send: (payload) => sent.push(payload) });
  return sent;
});
const currentClient = [];
const staleBlogClient = [];
const staleChangelogClient = [];
handler('document-session.2', { send: (payload) => currentClient.push(payload) });
handler('document-session.1', { send: (payload) => staleBlogClient.push(payload) });
handler('document-session.1', { send: (payload) => staleChangelogClient.push(payload) });
console.log(JSON.stringify({ results, currentClient, staleBlogClient, staleChangelogClient, broadcasts, wsToken: resolved.webSocketToken }));`,
    ],
    {
      env: {
        ...process.env,
        NOTRA_BUILD_PARAMS: paramsPath,
        NOTRA_DEV_HMR_TOKEN: "fallback-auth-session.2",
        NOTRA_DEV_DOCUMENT_TOKEN: "document-session.2",
        NOTRA_DEV_HMR_EVENT: DEV_HMR_GENERATION_EVENT,
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  try {
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(await errors).toBe("");
    const result = JSON.parse(await output);
    expect(result.wsToken).toBe("fallback-auth-session.2");
    expect(result.results[0]).toEqual([{ type: "full-reload" }]);
    expect(
      result.results.slice(1).every((sent: unknown[]) => sent.length === 0)
    ).toBe(true);
    expect(result.currentClient).toEqual([]);
    expect(result.staleBlogClient).toEqual([{ type: "full-reload" }]);
    expect(result.staleChangelogClient).toEqual([{ type: "full-reload" }]);
    expect(result.broadcasts).toBe(0);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await child.exited;
    }
    await rm(root, { recursive: true, force: true });
  }
});
