import { expect, test } from "bun:test";

import type { SiteDraftInput } from "@/types/site-drafts";

import {
  parseSiteConfig,
  patchDesign,
  readDesignForm,
  serializeSiteConfig,
} from "./site-design";
import { createSiteDraftSaveQueue } from "./site-draft-save-queue";

test("article and settings use the same branch-scoped file queues across view navigation", async () => {
  const writes: SiteDraftInput[] = [];
  const queues = new Map<string, ReturnType<typeof createSiteDraftSaveQueue>>();
  const queueFor = (path: string) => {
    let queue = queues.get(path);
    if (!queue) {
      queue = createSiteDraftSaveQueue({
        save: async (input) => {
          writes.push(input);
          return {
            path,
            updatedAt: new Date(),
            draftId: `draft-${path}`,
            draftRevision: 1,
          };
        },
        discard: async () => {},
        onDiscarded: async () => {},
        onSaved: () => {},
        onStateChange: () => {},
        errorMessage: String,
      });
      queues.set(path, queue);
    }
    return queue;
  };
  const input = (path: string, content: string): SiteDraftInput => ({
    organizationId: "synthetic",
    siteId: "site_synthetic",
    branch: "notra/site-edit/synthetic",
    path,
    content,
    baseCommitSha: "base",
    baseBlobSha: "blob",
    draftId: null,
    draftRevision: null,
    sourceContext: {
      repositoryId: "",
      productionBranch: "release",
      rootDirectory: "",
    },
  });
  const original = '{\n  "name": "Original", "custom": {"keep": true}\n}\n';
  const config = parseSiteConfig(original);
  const form = readDesignForm(config);
  expect(writes).toEqual([]);
  queueFor("blog/a.mdx").edit(input("blog/a.mdx", "Article edit"));
  queueFor("blog.json").edit(
    input(
      "blog.json",
      serializeSiteConfig(
        patchDesign(config, { ...form, name: "New name" }, form)
      )
    )
  );
  expect(queueFor("blog/a.mdx").getSnapshot().content).toBe("Article edit");
  expect(
    parseSiteConfig(queueFor("blog.json").getSnapshot().content!).custom
  ).toEqual({ keep: true });
  await Promise.all([...queues.values()].map((queue) => queue.flush()));
  expect(writes).toHaveLength(2);
  expect(
    writes.every((write) => write.branch === "notra/site-edit/synthetic")
  ).toBe(true);
  expect(original).toBe(
    '{\n  "name": "Original", "custom": {"keep": true}\n}\n'
  );
});

test("invalid JSON has no form representation to overwrite Source", () => {
  expect(() => parseSiteConfig('{"name":')).toThrow();
});
