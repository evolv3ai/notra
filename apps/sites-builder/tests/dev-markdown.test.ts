import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { devMarkdown } from "../compiler/utils/dev-markdown";

test("dev Markdown matches the hosted entry and index format without rewriting assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "notra-dev-markdown-test-"));
  const paramsPath = join(root, "params.json");
  await writeFile(
    paramsPath,
    JSON.stringify({
      config: { markdown: { instructions: "Cite this site." } },
    })
  );
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/blog/notra-pages.json") {
        return Response.json({
          title: "Local blog",
          indexPath: "/blog",
          entries: [
            {
              path: "/blog/hello",
              title: "Hello world",
              date: "2026-10-12",
              tags: [],
            },
          ],
        });
      }
      if (pathname === "/blog/download.md") {
        return new Response("Raw Markdown asset", {
          headers: { "Content-Type": "text/markdown" },
        });
      }
      if (pathname === "/blog/missing.md") {
        return new Response("Missing", { status: 404 });
      }
      return new Response(
        '<main data-md-root><p>Post body with a <a href="/blog/other">link</a>.</p></main>',
        { headers: { "Content-Type": "text/html" } }
      );
    },
  });
  if (server.port === undefined) {
    throw new Error("The test server did not allocate a TCP port");
  }
  const area = {
    area: "blog" as const,
    mount: "/blog",
    port: server.port,
    paramsPath,
  };
  try {
    const post = await devMarkdown(
      area,
      "/blog/hello.md",
      "http://localhost:4321"
    );
    expect(post.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    const body = await post.text();
    expect(body).toContain("# Hello world");
    expect(body).toContain("- Published: 2026-10-12");
    expect(body).toContain("[link](http://localhost:4321/blog/other)");
    expect(body).toContain("Cite this site.");
    expect(
      await (
        await devMarkdown(area, "/blog/index.md", "http://localhost:4321")
      ).text()
    ).toContain("# Local blog");
    expect(
      await (
        await devMarkdown(area, "/blog/download.md", "http://localhost:4321")
      ).text()
    ).toBe("Raw Markdown asset");
    expect(
      (await devMarkdown(area, "/blog/missing.md", "http://localhost:4321"))
        .status
    ).toBe(404);
    expect(
      (await devMarkdown(area, "/blog/author/ada.md", "http://localhost:4321"))
        .status
    ).toBe(404);
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

for (const mount of ["/blog", "/"]) {
  test(`an index-named entry at ${mount} wins over the Markdown listing alias`, async () => {
    const root = await mkdtemp(join(tmpdir(), "notra-dev-index-test-"));
    const paramsPath = join(root, "params.json");
    await writeFile(paramsPath, JSON.stringify({ config: {} }));
    const indexPath = mount === "/" ? "/" : mount;
    const entryPath = mount === "/" ? "/index" : `${mount}/index`;
    const requested: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const { pathname } = new URL(request.url);
        requested.push(pathname);
        if (pathname.endsWith("/notra-pages.json")) {
          return Response.json({
            title: "Listing title",
            indexPath,
            entries: [{ path: entryPath, title: "Index post", tags: [] }],
          });
        }
        return new Response(
          `<main data-md-root><p>${pathname === entryPath ? "Index post body" : "Listing body"}</p></main>`
        );
      },
    });
    if (server.port === undefined) {
      throw new Error("The test server did not allocate a TCP port");
    }
    const area = {
      area: "blog" as const,
      mount,
      port: server.port,
      paramsPath,
    };
    try {
      const response = await devMarkdown(
        area,
        `${entryPath}.md`,
        "http://localhost:4321"
      );
      const markdown = await response.text();
      expect(markdown).toContain("# Index post");
      expect(markdown).toContain("Index post body");
      expect(markdown).not.toContain("# Listing title");
      expect(requested.at(-1)).toBe(entryPath);
      const listing = await devMarkdown(
        area,
        mount === "/" ? "/.md" : `${mount}.md`,
        "http://localhost:4321"
      );
      expect(await listing.text()).toContain("# Listing title");
    } finally {
      server.stop(true);
      await rm(root, { recursive: true, force: true });
    }
  });
}
