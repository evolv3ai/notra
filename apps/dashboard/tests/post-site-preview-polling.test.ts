import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("post preview keeps polling until asynchronous deletion completes", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--eval",
      String.raw`
        import assert from "node:assert/strict";
        import { mock } from "bun:test";
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

        let options;
        mock.module("@/lib/orpc/query", () => ({
          dashboardOrpc: { sites: { previews: {
            sitesForPost: { queryOptions: () => ({
              queryKey: ["sites"], queryFn: async () => [],
            }) },
            postStatus: { queryOptions: (input) => {
              options = input;
              return { ...input, queryKey: ["status"], queryFn: async () => null };
            } },
          } } },
        }));
        const { usePrefetchPostSitePreview } = await import("@/lib/hooks/use-post-site-preview");
        const { POST_PREVIEW_POLL_MS } = await import("@/constants/sites");
        function Preview() {
          usePrefetchPostSitePreview("org", "post");
          return null;
        }
        const client = new QueryClient();
        renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Preview)));
        const interval = (data) => options.refetchInterval({ state: { data } });
        assert.equal(interval({ status: "ready", deleting: true }), POST_PREVIEW_POLL_MS);
        assert.equal(interval({ status: "queued", deleting: false }), POST_PREVIEW_POLL_MS);
        assert.equal(interval({ status: "ready", live: false, expiresAt: new Date(Date.now() + 60_000).toISOString() }), POST_PREVIEW_POLL_MS);
        assert.equal(interval({ status: "ready", live: false, expiresAt: new Date(Date.now() - 60_000).toISOString() }), false);
        assert.equal(interval({ status: "ready", live: true, expiresAt: new Date(Date.now() + 60_000).toISOString() }), false);
        assert.equal(interval({ status: "ready", deleting: false }), false);
        assert.equal(interval({ status: "failed", deleting: false }), false);
        assert.equal(interval(null), false);
        client.clear();
      `,
    ],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), timeout: 15_000 }
  );
  expect(
    result.status,
    result.stdout.toString() + result.stderr.toString()
  ).toBe(0);
}, 20_000);
