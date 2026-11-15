import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { findFreePort } from "../compiler/dev-server";

test("interrupting startup cleans its session and tolerates repeated signals", async () => {
  const toolchain = fileURLToPath(new URL("..", import.meta.url));
  const root = await mkdtemp(join(tmpdir(), "notra-dev-startup-test-"));
  const source = join(root, "source");
  const temp = join(root, "temp");
  await mkdir(join(source, "blog"), { recursive: true });
  await mkdir(temp);
  await writeFile(
    join(source, "blog", "hello.mdx"),
    '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\nHello startup.\n'
  );
  const port = await findFreePort(19500);
  const child = Bun.spawn(
    [
      process.execPath,
      join(toolchain, "compiler", "cli.ts"),
      "dev",
      "--source",
      source,
      "--port",
      String(port),
    ],
    { env: { ...process.env, TMPDIR: temp }, stdout: "pipe", stderr: "pipe" }
  );
  const output = Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  try {
    const deadline = Date.now() + 10_000;
    let connected = false;
    while (Date.now() < deadline) {
      const listening = await new Promise<boolean>((resolve) => {
        const socket = connect(port, "127.0.0.1");
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => resolve(false));
      });
      if (listening) {
        connected = true;
        break;
      }
      await Bun.sleep(10);
    }
    expect(connected).toBe(true);
    child.kill("SIGINT");
    await Bun.sleep(2);
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
    expect(
      await Promise.race([child.exited, Bun.sleep(10_000).then(() => -1)])
    ).toBe(0);
    await output;
    expect(
      (await readdir(temp)).filter((name) =>
        name.startsWith("notra-sites-dev-")
      )
    ).toEqual([]);
    expect(
      await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(500),
      }).catch(() => null)
    ).toBeNull();
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await child.exited;
    }
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

test("a site with errors at startup stays up, shows them, and starts once fixed", async () => {
  const toolchain = fileURLToPath(new URL("..", import.meta.url));
  const root = await mkdtemp(join(tmpdir(), "notra-dev-startup-test-"));
  const source = join(root, "source");
  const post = join(source, "blog", "hello.mdx");
  await mkdir(join(source, "blog"), { recursive: true });
  await writeFile(
    post,
    '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\n<Steps>\nunclosed\n'
  );
  const port = await findFreePort(19600);
  const child = Bun.spawn(
    [
      process.execPath,
      join(toolchain, "compiler", "cli.ts"),
      "dev",
      "--source",
      source,
      "--port",
      String(port),
    ],
    { stdout: "pipe", stderr: "pipe" }
  );
  // Drain both pipes; a full pipe buffer blocks the preview's log writes.
  const output = Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const document = () =>
    fetch(`http://localhost:${port}/blog`, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
  const errorState = async () => {
    const response = await fetch(
      `http://localhost:${port}/__notra-dev/errors`
    ).catch(() => null);
    return response
      ? ((await response.json()) as { count: number; key: string })
      : { count: -1, key: "" };
  };
  const errorCount = async () => (await errorState()).count;
  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && (await errorCount()) !== 1) {
      await Bun.sleep(50);
    }
    const broken = await document();
    expect(broken.status).toBe(500);
    expect(await broken.text()).toContain("blog/hello.mdx");
    expect(child.exitCode).toBeNull();

    const { key } = await errorState();
    await writeFile(
      post,
      '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\n<FancyChart />\n'
    );
    const changedDeadline = Date.now() + 15_000;
    let changed = await errorState();
    while (Date.now() < changedDeadline && changed.key === key) {
      await Bun.sleep(50);
      changed = await errorState();
    }
    expect(changed.count).toBe(1);
    expect(changed.key).not.toBe(key);
    expect(await (await document()).text()).toContain("FancyChart");

    await writeFile(
      post,
      '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\nFixed startup.\n'
    );
    const fixedDeadline = Date.now() + 30_000;
    let fixed: Response | undefined;
    while (Date.now() < fixedDeadline) {
      if ((await errorCount()) === 0) {
        fixed = await document().catch(() => undefined);
        if (fixed?.ok) {
          break;
        }
      }
      await Bun.sleep(100);
    }
    expect(fixed?.status).toBe(200);
    expect(await fixed?.text()).toContain("Hello");
  } finally {
    child.kill("SIGTERM");
    await child.exited;
    await output;
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
