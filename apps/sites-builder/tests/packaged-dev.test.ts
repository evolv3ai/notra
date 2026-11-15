import { afterAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { findFreePort } from "../compiler/dev-server";

const toolchain = fileURLToPath(new URL("..", import.meta.url));
const exported = await mkdtemp(join(tmpdir(), "notra-sites-export-"));
const cliPackage = join(exported, "cli");
await mkdir(cliPackage);
const { dependencies: renderer } = JSON.parse(
  await readFile(join(toolchain, "package.json"), "utf8")
);
// Mirrors notra-cli: its own files list, plus one dependency it shares.
await writeFile(
  join(cliPackage, "package.json"),
  `${JSON.stringify({ name: "notra-export-test", version: "0.0.0", files: ["dist"], dependencies: { chalk: "^5.3.0", react: renderer.react } })}\n`
);

const result = Bun.spawnSync(
  [process.execPath, "run", "export:cli", cliPackage],
  { cwd: toolchain, stdout: "pipe", stderr: "pipe" }
);
if (result.exitCode !== 0) {
  throw new Error(`export:cli failed:\n${result.stderr.toString()}`);
}
const packed = Bun.spawnSync(["npm", "pack", "--pack-destination", exported], {
  cwd: cliPackage,
  stdout: "pipe",
  stderr: "pipe",
});
if (packed.exitCode !== 0) {
  throw new Error(`npm pack failed:\n${packed.stderr.toString()}`);
}
const archive = join(exported, "notra-export-test-0.0.0.tgz");

afterAll(() => rm(exported, { recursive: true, force: true }));

// The CLI runs the exported renderer with whichever runtime started it.
async function installedRuntime(root: string) {
  const consumer = join(root, "consumer");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), '{"private":true}\n');
  const installed = Bun.spawnSync(
    [
      "npm",
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      archive,
    ],
    { cwd: consumer, stdout: "pipe", stderr: "pipe" }
  );
  if (installed.exitCode !== 0) {
    throw new Error(`npm install failed:\n${installed.stderr.toString()}`);
  }
  return join(consumer, "node_modules/notra-export-test/sites/dist/cli.mjs");
}

const launchers = {
  bun: async (root: string) => [
    process.execPath,
    "--bun",
    await installedRuntime(root),
  ],
  node: async (root: string) => ["node", await installedRuntime(root)],
};

test("the export ships the renderer and keeps the CLI's own dependencies", async () => {
  const manifest = JSON.parse(
    await readFile(join(cliPackage, "package.json"), "utf8")
  );
  expect(manifest.files).toEqual(["dist", "sites"]);
  expect(manifest.dependencies).toEqual({ ...renderer, chalk: "^5.3.0" });
  for (const range of Object.values<string>(manifest.dependencies)) {
    expect(range).not.toMatch(/^(workspace|file|link):/);
  }
  const { added } = JSON.parse(
    await readFile(join(cliPackage, "sites", "manifest.json"), "utf8")
  );
  expect(added.astro).toBe(renderer.astro);
  expect(added.react).toBeUndefined();
  const listing = Bun.spawnSync(["tar", "tzf", archive]).stdout.toString();
  expect(listing).toContain("package/sites/dist/cli.mjs");

  const again = Bun.spawnSync(
    [process.execPath, "scripts/export-cli.ts", cliPackage],
    { cwd: toolchain, stdout: "pipe", stderr: "pipe" }
  );
  expect(again.exitCode).toBe(0);
  expect(
    JSON.parse(await readFile(join(cliPackage, "package.json"), "utf8"))
  ).toEqual(manifest);
});

test("the export rejects a CLI edit to a range it added", async () => {
  const edited = join(exported, "edited");
  await mkdir(join(edited, "sites"), { recursive: true });
  await writeFile(
    join(edited, "package.json"),
    JSON.stringify({ name: "edited", dependencies: { astro: "^99.0.0" } })
  );
  await writeFile(
    join(edited, "sites", "manifest.json"),
    JSON.stringify({ added: { astro: renderer.astro } })
  );
  const run = Bun.spawnSync(
    [process.execPath, "scripts/export-cli.ts", edited],
    { cwd: toolchain, stdout: "pipe", stderr: "pipe" }
  );
  expect(run.exitCode).not.toBe(0);
  expect(run.stderr.toString()).toContain("astro (^99.0.0, exported");
});

test("the export rejects a CLI range that differs from the renderer's", async () => {
  const conflicting = join(exported, "conflicting");
  await mkdir(conflicting);
  await writeFile(
    join(conflicting, "package.json"),
    JSON.stringify({ name: "conflicting", dependencies: { astro: "^1.0.0" } })
  );
  const run = Bun.spawnSync(
    [process.execPath, "scripts/export-cli.ts", conflicting],
    { cwd: toolchain, stdout: "pipe", stderr: "pipe" }
  );
  expect(run.exitCode).not.toBe(0);
  expect(run.stderr.toString()).toContain("astro (^1.0.0 vs");
});

test.each(Object.keys(launchers) as (keyof typeof launchers)[])(
  "the installed package hot-reloads content and config on %s",
  async (runtime) => {
    const root = await mkdtemp(join(tmpdir(), "notra-packaged-dev-test-"));
    let output = "";
    let child: ReturnType<typeof Bun.spawn> | undefined;
    try {
      const source = join(root, "customer site");
      await mkdir(join(source, "blog"), { recursive: true });
      const post = join(source, "blog", "hello.mdx");
      await writeFile(
        post,
        '---\ntitle: "Original post"\ndate: 2026-10-12\n---\n\nOriginal content.\n'
      );
      const port = await findFreePort(19000);
      child = Bun.spawn(
        [
          ...(await launchers[runtime](root)),
          "dev",
          "--source",
          source,
          "--port",
          String(port),
        ],
        { cwd: source, stdout: "pipe", stderr: "pipe" }
      );
      const drain = async (stream: ReadableStream<Uint8Array>) => {
        for await (const chunk of stream) {
          output += new TextDecoder().decode(chunk);
        }
      };
      const drained = Promise.all([
        drain(child.stdout as ReadableStream<Uint8Array>),
        drain(child.stderr as ReadableStream<Uint8Array>),
      ]);
      const waitForPage = async (text: string, slug = "hello") => {
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          if (child?.exitCode !== null) {
            throw new Error(`Preview exited early:\n${output}`);
          }
          const response = await fetch(
            `http://127.0.0.1:${port}/blog/${slug}`,
            { signal: AbortSignal.timeout(2000) }
          ).catch(() => null);
          if (response?.ok && (await response.text()).includes(text)) {
            return;
          }
          await Bun.sleep(200);
        }
        throw new Error(`Preview never rendered ${text}:\n${output}`);
      };
      await waitForPage("Original content.");
      const markdown = await fetch(`http://127.0.0.1:${port}/blog/hello.md`);
      expect(markdown.status).toBe(200);
      expect(markdown.headers.get("content-type")).toContain("text/markdown");
      expect(await markdown.text()).toContain("# Original post");
      await writeFile(
        post,
        '---\ntitle: "Updated post"\ndate: 2026-10-12\n---\n\nUpdated content.\n'
      );
      await waitForPage("Updated content.");
      expect(
        await (await fetch(`http://127.0.0.1:${port}/blog/hello.md`)).text()
      ).toContain("Updated content.");
      await writeFile(
        join(source, "blog.json"),
        JSON.stringify({ name: "Updated site name" })
      );
      await waitForPage("Updated site name");
      await mkdir(join(source, "snippets"));
      await writeFile(
        join(source, "snippets", "counter.jsx"),
        "export const Counter = () => { const [count, setCount] = useState(0); return <button onClick={() => setCount(count + 1)}>Counter: {count}</button>; };"
      );
      await writeFile(
        join(source, "blog", "counter.mdx"),
        '---\ntitle: "Interactive component"\ndate: 2026-10-12\n---\n\nimport { Counter } from "/snippets/counter.jsx";\n\n<Counter />\n'
      );
      await waitForPage("Counter:", "counter");
      child.kill("SIGINT");
      expect(
        await Promise.race([child.exited, Bun.sleep(10_000).then(() => -1)])
      ).toBe(0);
      await drained;
      expect(
        await fetch(`http://127.0.0.1:${port}/blog/hello`).catch(() => null)
      ).toBeNull();
    } finally {
      if (child?.exitCode === null) {
        child.kill("SIGTERM");
        await child.exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000
);
