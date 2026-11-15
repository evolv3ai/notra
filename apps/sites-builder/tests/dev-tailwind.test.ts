import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { findFreePort } from "../compiler/dev-server";

test("dev generates Tailwind classes used in slots and posts, including ones added while running", async () => {
  const toolchain = fileURLToPath(new URL("..", import.meta.url));
  const root = await mkdtemp(join(tmpdir(), "notra-dev-tailwind-test-"));
  const source = join(root, "source");
  await mkdir(join(source, "blog"), { recursive: true });
  await writeFile(
    join(source, "header.mdx"),
    '<header className="bg-[#0a1b2c]">Header</header>\n'
  );
  await writeFile(
    join(source, "blog", "hello.mdx"),
    '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\n<div className="text-[#3c4d5e]">Hello</div>\n'
  );
  const port = await findFreePort(19700);
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
    {
      // bun test sets NODE_ENV=test, which stops Vite's CSS hot updates.
      env: { ...process.env, NODE_ENV: "development" },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const output = Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const pageContaining = async (text: string) => {
    const deadline = Date.now() + 30_000;
    let html = "";
    while (Date.now() < deadline && !html.includes(text)) {
      const response = await fetch(`http://localhost:${port}/blog/hello`, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      html = response?.ok ? await response.text() : "";
      await Bun.sleep(100);
    }
    return html;
  };
  try {
    const html = await pageContaining("bg-\\[\\#0a1b2c\\]");
    expect(html).toContain("bg-\\[\\#0a1b2c\\]");
    expect(html).toContain("text-\\[\\#3c4d5e\\]");
    await writeFile(
      join(source, "header.mdx"),
      '<header className="bg-[#5e6f70]">Header</header>\n'
    );
    expect(await pageContaining("bg-\\[\\#5e6f70\\]")).toContain(
      "bg-\\[\\#5e6f70\\]"
    );
  } finally {
    child.kill("SIGTERM");
    await child.exited;
    await output;
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
