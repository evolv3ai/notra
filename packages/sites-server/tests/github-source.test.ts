import { afterAll, afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SITE_BUILD_LIMITS } from "@notra/sites-core/constants/sites";
import { SITE_IGNORE_MAX_BYTES } from "@notra/sites-core/constants/source";
import { Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import {
  GITHUB_ARCHIVE_TIMEOUT_MS,
  GITHUB_SOURCE_DOWNLOAD_CONCURRENCY,
  GITHUB_SOURCE_DOWNLOAD_MAX_FILES,
} from "../src/constants/github";
import { SitePermanentBuildError } from "../src/errors/sites";
import { downloadSiteSourceEffect } from "../src/github-source";
import { readTarGz } from "../src/utils/read-tar-gz";
import { runSitesEffect } from "../src/utils/run-sites-effect";
import { githubRepository } from "./constants/provider-effect";

const commit = "a".repeat(40);
const parent = "b".repeat(40);
const subtree = "c".repeat(40);
const blob = "d".repeat(40);
const metadataBlob = "f".repeat(40);
const binary = new Uint8Array([0, 255, 128, 1]);
const sourceFile = {
  path: "public/image.png",
  mode: "100644",
  type: "blob",
  sha: blob,
  size: binary.length,
};
const transport = spyOn(globalThis, "fetch");
let entries = [sourceFile];
let truncatedTree = "";
let metadata = new Uint8Array();
let rootMetadata: typeof entries = [];
let parentMetadata: typeof entries = [];

beforeEach(() => {
  entries = [sourceFile];
  truncatedTree = "";
  metadata = new Uint8Array();
  rootMetadata = [];
  parentMetadata = [];
  transport.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer synthetic-token"
    );
    if (url.pathname.endsWith(`/tarball/${commit}`)) {
      expect(init?.redirect).toBe("follow");
      return new Response(binary);
    }
    expect(init?.redirect).toBe("error");
    if (url.pathname.endsWith(`/trees/${commit}`)) {
      expect(url.search).toBe("");
      return Response.json({
        truncated: truncatedTree === commit,
        tree: [
          ...rootMetadata,
          { path: "sites", mode: "040000", type: "tree", sha: parent },
          {
            path: "unrelated-large-file",
            mode: "100644",
            type: "blob",
            sha: "e".repeat(40),
            size: SITE_BUILD_LIMITS.maxSourceBytes + 1,
          },
        ],
      });
    }
    if (url.pathname.endsWith(`/trees/${parent}`)) {
      expect(url.search).toBe("");
      return Response.json({
        truncated: truncatedTree === parent,
        tree: [
          ...parentMetadata,
          { path: "demo", mode: "040000", type: "tree", sha: subtree },
        ],
      });
    }
    if (url.pathname.endsWith(`/trees/${subtree}`)) {
      expect(url.search).toBe("?recursive=1");
      return Response.json({
        truncated: truncatedTree === subtree,
        tree: entries,
      });
    }
    if (url.pathname.includes("/blobs/")) {
      expect(new Headers(init?.headers).get("accept")).toBe(
        "application/vnd.github.raw+json"
      );
      return new Response(
        url.pathname.endsWith(`/blobs/${metadataBlob}`) ? metadata : binary
      );
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
});
afterEach(() => transport.mockReset());
afterAll(() => transport.mockRestore());

test("loads only the selected subtree at the pinned commit and emits an extractable archive", async () => {
  metadata = new TextEncoder().encode("# ignored\n");
  entries.push({
    ...sourceFile,
    path: ".notraignore",
    sha: metadataBlob,
    size: metadata.length,
  });
  entries.push({
    ...sourceFile,
    path: `snippets/${"long-name-".repeat(20)}.mdx`,
  });
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  const files = readTarGz(archive, {
    maxFiles: 10,
    maxBytes: 100,
    maxFileBytes: 10,
  });
  expect(files.map((file) => file.path).sort()).toEqual(
    entries.map((entry) => `source/sites/demo/${entry.path}`).sort()
  );
  expect(
    files
      .filter((file) => !file.path.endsWith("/.notraignore"))
      .every((file) => Buffer.from(file.data).equals(binary))
  ).toBe(true);
  expect(
    files.find((file) => file.path.endsWith("/.notraignore"))?.data
  ).toEqual(metadata);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("tarball"))
  ).toBe(false);
  const directory = mkdtempSync(join(tmpdir(), "site-source-"));
  try {
    writeFileSync(join(directory, "source.tgz"), archive);
    const result = spawnSync(
      "tar",
      ["xzf", "source.tgz", "--strip-components=1"],
      { cwd: directory }
    );
    expect(result.status).toBe(0);
    expect(
      readFileSync(join(directory, "sites/demo/public/image.png"))
    ).toEqual(Buffer.from(binary));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("sites in the repository root retain the existing archive download", async () => {
  transport.mockImplementation(async (input, init) => {
    expect(String(input)).toEndWith(`/tarball/${commit}`);
    expect(init?.redirect).toBe("follow");
    return new Response(binary);
  });
  expect(
    await runSitesEffect(
      downloadSiteSourceEffect(githubRepository, "synthetic-token", commit, "")
    )
  ).toEqual(binary);
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each(["../sites", "/sites", "sites/../demo", "sites/.hidden"])(
  "rejects unsafe root %s before GitHub requests",
  async (root) => {
    await expect(
      runSitesEffect(
        downloadSiteSourceEffect(
          githubRepository,
          "synthetic-token",
          commit,
          root
        )
      )
    ).rejects.toBeInstanceOf(SitePermanentBuildError);
    expect(transport).not.toHaveBeenCalled();
  }
);

test("a missing selected directory fails without falling back to a full repository download", async () => {
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "missing"
      )
    )
  ).rejects.toMatchObject({
    message: expect.stringContaining("does not exist"),
  });
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each([commit, parent, subtree])(
  "a truncated tree %s falls back to the pinned archive without downloading blobs",
  async (sha) => {
    truncatedTree = sha;
    const archive = await runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    );
    expect(archive).toEqual(binary);
    expect(String(transport.mock.calls.at(-1)?.[0])).toContain(
      `/tarball/${commit}`
    );
    expect(
      transport.mock.calls.some(([url]) => String(url).includes("/blobs/"))
    ).toBe(false);
  }
);

test.each([
  GITHUB_SOURCE_DOWNLOAD_MAX_FILES,
  GITHUB_SOURCE_DOWNLOAD_MAX_FILES + 1,
])(
  "%s collected files choose the bounded blob download or the pinned tarball",
  async (count) => {
    entries = Array.from({ length: count }, (_, index) => ({
      ...sourceFile,
      path: `public/image-${index}.png`,
    }));
    const archive = await runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    );
    const fallback = count > GITHUB_SOURCE_DOWNLOAD_MAX_FILES;
    expect(
      transport.mock.calls.some(([url]) => String(url).includes("tarball"))
    ).toBe(fallback);
    if (fallback) {
      expect(archive).toEqual(binary);
      expect(transport).toHaveBeenCalledTimes(4);
    } else {
      expect(
        readTarGz(archive, {
          maxFiles: count,
          maxBytes: count * binary.length,
          maxFileBytes: binary.length,
        })
      ).toHaveLength(count);
      expect(transport).toHaveBeenCalledTimes(3 + count);
    }
  }
);

test("excluded files and backslash filenames do not count toward the blob budget or fail the build", async () => {
  entries.push(
    ...Array.from(
      { length: GITHUB_SOURCE_DOWNLOAD_MAX_FILES + 1 },
      (_, index) => ({ ...sourceFile, path: `node_modules/image-${index}.png` })
    )
  );
  entries.push(
    { ...sourceFile, path: "notes\\old.txt" },
    { ...sourceFile, path: "public/old\\image.png" }
  );
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    readTarGz(archive, {
      maxFiles: 1,
      maxBytes: binary.length,
      maxFileBytes: binary.length,
    }).map((file) => file.path)
  ).toEqual(["source/sites/demo/public/image.png"]);
  expect(transport).toHaveBeenCalledTimes(4);
});

test.each([
  "../outside",
  "/absolute",
  "folder/../outside",
  "folder//file",
  "file\0name",
])("rejects unsafe source path %s before downloading blobs", async (path) => {
  entries = [{ ...sourceFile, path }];
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).rejects.toBeInstanceOf(SitePermanentBuildError);
  expect(transport).toHaveBeenCalledTimes(3);
});

test.each(["120000", "160000"])(
  "skips nonregular source mode %s without fetching or following its target",
  async (mode) => {
    entries = [
      { ...sourceFile, mode, type: mode === "160000" ? "commit" : "blob" },
    ];
    const archive = await runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    );
    expect(
      readTarGz(archive, { maxFiles: 1, maxBytes: 0, maxFileBytes: 0 })
    ).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(3);
  }
);

test("rejects duplicate paths before any blob downloads", async () => {
  entries.push({ ...sourceFile });
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).rejects.toMatchObject({ message: expect.stringContaining("duplicate") });
});

test.each([
  "README.md",
  "public/image.bmp",
  ".hidden/styles.css",
  "public/.hidden/image.png",
  "node_modules/library/styles.css",
])("does not fetch or count oversized excluded path %s", async (path) => {
  entries.push({
    ...sourceFile,
    path,
    sha: "e".repeat(40),
    size: SITE_BUILD_LIMITS.maxSourceBytes + 1,
  });
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    readTarGz(archive, { maxFiles: 1, maxBytes: 10, maxFileBytes: 10 }).map(
      (file) => file.path
    )
  ).toEqual(["source/sites/demo/public/image.png"]);
  expect(
    transport.mock.calls.filter(([url]) => String(url).includes("/blobs/"))
  ).toHaveLength(1);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("e".repeat(40)))
  ).toBe(false);
});

test("excluded files do not consume the source file count budget", async () => {
  entries.push(
    ...Array.from(
      { length: SITE_BUILD_LIMITS.maxSourceFiles + 1 },
      (_, index) => ({
        ...sourceFile,
        path: `node_modules/library/file-${index}.png`,
        sha: "e".repeat(40),
      })
    )
  );
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    readTarGz(archive, { maxFiles: 1, maxBytes: 10, maxFileBytes: 10 })
  ).toHaveLength(1);
  expect(
    transport.mock.calls.filter(([url]) => String(url).includes("/blobs/"))
  ).toHaveLength(1);
});

test("an excluded-only subtree preserves an empty compiler source directory after extraction", async () => {
  entries = [{ ...sourceFile, path: "README.md" }];
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("/blobs/"))
  ).toBe(false);
  const directory = mkdtempSync(join(tmpdir(), "site-empty-source-"));
  try {
    writeFileSync(join(directory, "source.tgz"), archive);
    const result = spawnSync(
      "tar",
      ["xzf", "source.tgz", "--strip-components=1"],
      { cwd: directory }
    );
    expect(result.status).toBe(0);
    const { collectSiteSource } =
      await import("../../../apps/sites-builder/compiler/collect");
    const source = await collectSiteSource(join(directory, "sites/demo"));
    expect(source.files).toEqual([]);
    expect(source.totalBytes).toBe(0);
    expect(source.diagnostics).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("loads and preserves .notraignore before excluding oversized eligible files", async () => {
  metadata = new TextEncoder().encode("public/ignored-*.png\n");
  entries.push({
    ...sourceFile,
    path: ".notraignore",
    sha: metadataBlob,
    size: metadata.length,
  });
  entries.push(
    ...Array.from(
      { length: SITE_BUILD_LIMITS.maxSourceFiles + 1 },
      (_, index) => ({
        ...sourceFile,
        path: `public/ignored-${index}.png`,
        sha: "e".repeat(40),
        size: SITE_BUILD_LIMITS.maxSourceBytes + 1,
      })
    )
  );
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  const files = readTarGz(archive, {
    maxFiles: 2,
    maxBytes: 100,
    maxFileBytes: 100,
  });
  expect(files.map((file) => file.path).sort()).toEqual([
    "source/sites/demo/.notraignore",
    "source/sites/demo/public/image.png",
  ]);
  expect(
    files.find((file) => file.path.endsWith("/.notraignore"))?.data
  ).toEqual(metadata);
  const blobs = transport.mock.calls.filter(([url]) =>
    String(url).includes("/blobs/")
  );
  expect(blobs).toHaveLength(2);
  expect(String(blobs[0]?.[0])).toEndWith(`/blobs/${metadataBlob}`);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("e".repeat(40)))
  ).toBe(false);
});

test("directory exclusions and collector-hidden directories cannot be bypassed by negation", async () => {
  metadata = new TextEncoder().encode(
    "public/excluded/\n!public/excluded/keep.png\n!public/.hidden/\n!public/.hidden/keep.png\n!node_modules/\n!node_modules/keep.png\n"
  );
  entries.push({
    ...sourceFile,
    path: ".notraignore",
    sha: metadataBlob,
    size: metadata.length,
  });
  for (const path of [
    "public/excluded/keep.png",
    "public/.hidden/keep.png",
    "node_modules/keep.png",
  ]) {
    entries.push({
      ...sourceFile,
      path,
      sha: "e".repeat(40),
      size: SITE_BUILD_LIMITS.maxSourceBytes + 1,
    });
  }
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    readTarGz(archive, { maxFiles: 2, maxBytes: 1000, maxFileBytes: 1000 })
  ).toHaveLength(2);
  expect(
    transport.mock.calls.filter(([url]) => String(url).includes("/blobs/"))
  ).toHaveLength(2);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("e".repeat(40)))
  ).toBe(false);
});

test.each(["120000", "160000"])(
  "rejects .notraignore mode %s before blob downloads",
  async (mode) => {
    entries.push({
      ...sourceFile,
      path: ".notraignore",
      mode,
      type: mode === "160000" ? "commit" : "blob",
      sha: metadataBlob,
    });
    await expect(
      runSitesEffect(
        downloadSiteSourceEffect(
          githubRepository,
          "synthetic-token",
          commit,
          "sites/demo"
        )
      )
    ).rejects.toBeInstanceOf(SitePermanentBuildError);
    expect(
      transport.mock.calls.some(([url]) => String(url).includes("/blobs/"))
    ).toBe(false);
  }
);

test("rejects oversized .notraignore before blob downloads", async () => {
  entries.push({
    ...sourceFile,
    path: ".notraignore",
    sha: metadataBlob,
    size: SITE_IGNORE_MAX_BYTES + 1,
  });
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).rejects.toBeInstanceOf(SitePermanentBuildError);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("/blobs/"))
  ).toBe(false);
});

test.each(["root", "parent", "subtree"])(
  "falls back to the pinned tarball for %s archive-transforming attributes",
  async (location) => {
    metadata = new TextEncoder().encode("public/*.png export-ignore\n");
    const attribute = {
      ...sourceFile,
      path: ".gitattributes",
      sha: metadataBlob,
      size: metadata.length,
    };
    if (location === "root") {
      rootMetadata.push(attribute);
    } else if (location === "parent") {
      parentMetadata.push(attribute);
    } else {
      entries.push({ ...attribute, path: "public/.gitattributes" });
    }
    const archive = await runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    );
    expect(archive).toEqual(binary);
    expect(
      transport.mock.calls.some(([url]) =>
        String(url).endsWith(`/tarball/${commit}`)
      )
    ).toBe(true);
    expect(
      transport.mock.calls.some(([url]) =>
        String(url).endsWith(`/blobs/${blob}`)
      )
    ).toBe(false);
  }
);

test("linguist-only Git attributes retain scoped source downloading", async () => {
  metadata = new TextEncoder().encode(
    "# GitHub language metadata\n*.mdx linguist-language=Markdown linguist-detectable=true\n"
  );
  rootMetadata.push({
    ...sourceFile,
    path: ".gitattributes",
    sha: metadataBlob,
    size: metadata.length,
  });
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    readTarGz(archive, { maxFiles: 1, maxBytes: 10, maxFileBytes: 10 })
  ).toHaveLength(1);
  expect(
    transport.mock.calls.some(([url]) =>
      String(url).endsWith(`/blobs/${metadataBlob}`)
    )
  ).toBe(true);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("/tarball/"))
  ).toBe(false);
});

test.each([
  "[attr]metadata linguist-generated=true\n",
  "*.mdx linguist-language=Markdown\npublic/*.png export-ignore\n",
])(
  "Git attributes outside the metadata allowlist trigger fallback: %s",
  async (content) => {
    metadata = new TextEncoder().encode(content);
    rootMetadata.push({
      ...sourceFile,
      path: ".gitattributes",
      sha: metadataBlob,
      size: metadata.length,
    });
    expect(
      await runSitesEffect(
        downloadSiteSourceEffect(
          githubRepository,
          "synthetic-token",
          commit,
          "sites/demo"
        )
      )
    ).toEqual(binary);
    expect(
      transport.mock.calls.some(([url]) =>
        String(url).endsWith(`/tarball/${commit}`)
      )
    ).toBe(true);
    expect(
      transport.mock.calls.some(([url]) =>
        String(url).endsWith(`/blobs/${blob}`)
      )
    ).toBe(false);
  }
);

test.each(["root", "parent", "subtree"])(
  ".lfsconfig in %s triggers fallback without fetching it or source blobs",
  async (location) => {
    const config = { ...sourceFile, path: ".lfsconfig", sha: metadataBlob };
    if (location === "root") {
      rootMetadata.push(config);
    } else if (location === "parent") {
      parentMetadata.push(config);
    } else {
      entries.push(config);
    }
    expect(
      await runSitesEffect(
        downloadSiteSourceEffect(
          githubRepository,
          "synthetic-token",
          commit,
          "sites/demo"
        )
      )
    ).toEqual(binary);
    expect(
      transport.mock.calls.some(([url]) =>
        String(url).endsWith(`/tarball/${commit}`)
      )
    ).toBe(true);
    expect(
      transport.mock.calls.some(([url]) => String(url).includes("/blobs/"))
    ).toBe(false);
  }
);

test("an LFS pointer in .notraignore falls back before parsing ignore rules or enforcing source limits", async () => {
  metadata = new TextEncoder().encode(
    `version https://git-lfs.github.com/spec/v1\noid sha256:${"1".repeat(64)}\nsize 1234\n`
  );
  entries = [
    { ...sourceFile, size: SITE_BUILD_LIMITS.maxSourceBytes + 1 },
    {
      ...sourceFile,
      path: ".notraignore",
      sha: metadataBlob,
      size: metadata.length,
    },
  ];
  expect(
    await runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).toEqual(binary);
  const blobs = transport.mock.calls.filter(([url]) =>
    String(url).includes("/blobs/")
  );
  expect(blobs).toHaveLength(1);
  expect(String(blobs[0]?.[0])).toEndWith(`/blobs/${metadataBlob}`);
  expect(String(transport.mock.calls.at(-1)?.[0])).toEndWith(
    `/tarball/${commit}`
  );
});

test("raw Git LFS pointers fall back to the pinned tarball", async () => {
  metadata = new TextEncoder().encode(
    `version https://git-lfs.github.com/spec/v1\noid sha256:${"1".repeat(64)}\nsize 1234\n`
  );
  entries = [{ ...sourceFile, sha: metadataBlob, size: metadata.length }];
  expect(
    await runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).toEqual(binary);
  expect(
    transport.mock.calls.some(([url]) =>
      String(url).endsWith(`/tarball/${commit}`)
    )
  ).toBe(true);
});

test("rejects file count, individual size and aggregate size before blob downloads", async () => {
  for (const size of [
    SITE_BUILD_LIMITS.maxSingleFileBytes + 1,
    binary.length,
  ]) {
    entries = Array.from(
      {
        length:
          size === binary.length ? SITE_BUILD_LIMITS.maxSourceFiles + 1 : 1,
      },
      (_, index) => ({
        path: `public/file-${index}.png`,
        mode: "100644",
        type: "blob",
        sha: blob,
        size,
      })
    );
    await expect(
      runSitesEffect(
        downloadSiteSourceEffect(
          githubRepository,
          "synthetic-token",
          commit,
          "sites/demo"
        )
      )
    ).rejects.toBeInstanceOf(SitePermanentBuildError);
  }
  entries = Array.from({ length: 9 }, (_, index) => ({
    path: `public/file-${index}.png`,
    mode: "100644",
    type: "blob",
    sha: blob,
    size: SITE_BUILD_LIMITS.maxSingleFileBytes,
  }));
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).rejects.toBeInstanceOf(SitePermanentBuildError);
  expect(
    transport.mock.calls.some(([url]) => String(url).includes("/blobs/"))
  ).toBe(false);
});

test("checks actual blob length against the selected tree", async () => {
  entries = [{ ...sourceFile, size: binary.length - 1 }];
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).rejects.toBeInstanceOf(SitePermanentBuildError);
  entries = [{ ...sourceFile, size: binary.length + 1 }];
  await expect(
    runSitesEffect(
      downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      )
    )
  ).rejects.toMatchObject({ message: expect.stringContaining("incomplete") });
});

test("downloads empty blobs without dropping them from the archive", async () => {
  entries = [{ ...sourceFile, size: 0 }];
  const original = transport.getMockImplementation();
  if (!original) {
    throw new Error("GitHub fixture is missing");
  }
  transport.mockImplementation(async (input, init) =>
    String(input).includes("/blobs/")
      ? new Response(new Uint8Array())
      : await original(input, init)
  );
  const archive = await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(
    readTarGz(archive, { maxFiles: 1, maxBytes: 0, maxFileBytes: 0 })[0]?.data
      .length
  ).toBe(0);
});

test("source body deadlines abort the HTTP request and cancel the reader", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const reading = yield* Deferred.make<void>();
      let aborted = false;
      let cancelled = false;
      transport.mockImplementation(async (_input, init) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
        });
        return new Response(
          new ReadableStream(
            {
              pull() {
                Effect.runSync(Deferred.succeed(reading, undefined));
              },
              cancel() {
                cancelled = true;
              },
            },
            { highWaterMark: 0 }
          )
        );
      });
      const fiber = yield* downloadSiteSourceEffect(
        githubRepository,
        "synthetic-token",
        commit,
        "sites/demo"
      ).pipe(Effect.forkChild);
      yield* Deferred.await(reading);
      yield* TestClock.adjust(GITHUB_ARCHIVE_TIMEOUT_MS);
      const exit = yield* Fiber.await(fiber);
      expect(exit._tag).toBe("Failure");
      expect(aborted).toBe(true);
      expect(cancelled).toBe(true);
    }).pipe(Effect.provide(TestClock.layer()))
  );
});

test("blob downloads stay within the configured concurrency", async () => {
  entries = Array.from(
    { length: GITHUB_SOURCE_DOWNLOAD_CONCURRENCY + 3 },
    (_, index) => ({
      path: `public/file-${index}.png`,
      mode: "100644",
      type: "blob",
      sha: blob,
      size: binary.length,
    })
  );
  const original = transport.getMockImplementation();
  if (!original) {
    throw new Error("GitHub fixture is missing");
  }
  let active = 0;
  let maximum = 0;
  transport.mockImplementation(async (input, init) => {
    if (!String(input).includes("/blobs/")) {
      return await original(input, init);
    }
    active++;
    maximum = Math.max(maximum, active);
    return new Response(
      new ReadableStream(
        {
          pull(controller) {
            active--;
            controller.enqueue(binary);
            controller.close();
          },
        },
        { highWaterMark: 0 }
      )
    );
  });
  await runSitesEffect(
    downloadSiteSourceEffect(
      githubRepository,
      "synthetic-token",
      commit,
      "sites/demo"
    )
  );
  expect(maximum).toBe(GITHUB_SOURCE_DOWNLOAD_CONCURRENCY);
});
