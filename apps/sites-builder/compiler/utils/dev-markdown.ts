import { readFile } from "node:fs/promises";

import { joinMountPath } from "@notra/sites-core/utils/mounts";

import type { BuildParams } from "../../src/types/build-params";
import {
  entryMarkdown,
  indexMarkdown,
  instructionsSection,
  normalizeAgentInstructions,
} from "../agent-files";
import type { AreaPages } from "../types/agent-files";
import type { DevAreaServer } from "../types/dev-server";
import { htmlToMarkdown } from "./html-to-markdown";

export async function devMarkdown(
  area: DevAreaServer,
  pathname: string,
  origin: string,
  signal?: AbortSignal
): Promise<Response> {
  let path = pathname.replace(/\.md$/, "") || "/";
  const upstreamSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000);
  const metadata = await fetch(
    `http://127.0.0.1:${area.port}${joinMountPath(area.mount, "notra-pages.json")}`,
    { signal: upstreamSignal }
  );
  if (!metadata.ok) {
    await metadata.body?.cancel();
    throw new Error("Unable to load local page metadata");
  }
  const pages = (await metadata.json()) as AreaPages;
  const entry = pages.entries.find((item) => item.path === path);
  if (!entry) {
    path = path.replace(/\/index$/, "") || "/";
  }
  if (!entry && path !== pages.indexPath.replace(/\/$/, "") && path !== "/") {
    const asset = await fetch(`http://127.0.0.1:${area.port}${pathname}`, {
      signal: upstreamSignal,
    });
    if (
      asset.ok &&
      !asset.headers.get("content-type")?.startsWith("text/html")
    ) {
      return asset;
    }
    await asset.body?.cancel();
    return new Response("# Page not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  const response = await fetch(`http://127.0.0.1:${area.port}${path}`, {
    signal: upstreamSignal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    return new Response("# Page not found\n", {
      status: response.status,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  const html = await response.text();
  const url = new URL(path, origin).toString();
  const markdown = entry
    ? entryMarkdown(entry, url, htmlToMarkdown(html, url))
    : indexMarkdown(pages, origin);
  const params = JSON.parse(
    await readFile(area.paramsPath, {
      encoding: "utf8",
      signal: upstreamSignal,
    })
  ) as BuildParams;
  const instructions = instructionsSection(
    normalizeAgentInstructions(params.config.markdown?.instructions)
  );
  return new Response(
    instructions ? `${markdown}\n${instructions}\n` : markdown,
    {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    }
  );
}
