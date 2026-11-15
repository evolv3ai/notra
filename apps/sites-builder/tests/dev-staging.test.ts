import { expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";

import { prepareSite } from "../compiler/prepare";
import type { OgImagesResult } from "../compiler/types/og-images";
import { createDevRefresh } from "../compiler/utils/dev-refresh";
import { writeFileEnsured } from "../compiler/utils/fs";

test("dev refresh preserves unchanged module identities and removes deleted posts", async () => {
  const root = await mkdtemp(join(tmpdir(), "notra-dev-staging-test-"));
  const source = join(root, "source");
  const workDir = join(root, "work");
  await mkdir(join(source, "blog"), { recursive: true });
  await mkdir(join(source, "snippets"));
  await writeFile(
    join(source, "blog", "hello.mdx"),
    '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\nHello staging.\n'
  );
  await writeFile(
    join(source, "snippets", "counter.jsx"),
    "export const Counter = () => { const [count] = useState(0); return <span>{count}</span>; };"
  );
  await writeFile(join(source, "style.css"), "p { color: red; }");
  await writeFile(join(source, "script.js"), 'document.title = "First";');
  try {
    const options = {
      siteRoot: source,
      workDir,
      incremental: true,
      defaultConfig: createDefaultSiteConfig("Staging test"),
    };
    const first = await prepareSite(options);
    expect(first.validation.ok).toBe(true);
    const module = join(workDir, "site", "snippets", "counter.jsx");
    const entry = join(workDir, "entries", "blog", "hello.mdx");
    const moduleBefore = await stat(module);
    const entryBefore = await stat(entry);
    await writeFile(join(source, "style.css"), "p { color: blue; }");
    expect((await prepareSite(options)).validation.ok).toBe(true);
    const moduleAfter = await stat(module);
    const entryAfter = await stat(entry);
    expect(moduleAfter.ino).toBe(moduleBefore.ino);
    expect(moduleAfter.mtimeMs).toBe(moduleBefore.mtimeMs);
    expect(entryAfter.ino).toBe(entryBefore.ino);
    expect(entryAfter.mtimeMs).toBe(entryBefore.mtimeMs);
    await writeFile(join(source, "script.js"), 'document.title = "Second";');
    const scriptUpdate = await prepareSite(options);
    expect(scriptUpdate.validation.ok).toBe(true);
    expect(scriptUpdate.customScripts[0]).not.toBe(first.customScripts[0]);
    await rm(join(source, "blog", "hello.mdx"));
    await writeFile(
      join(source, "blog", "new.mdx"),
      '---\ntitle: "New"\ndate: 2026-10-12\n---\n\nNew staging.\n'
    );
    expect((await prepareSite(options)).validation.ok).toBe(true);
    expect(await stat(entry).catch(() => null)).toBeNull();
    expect(
      await stat(join(workDir, "site", "blog", "hello.mdx")).catch(() => null)
    ).toBeNull();
    expect(
      (await stat(join(workDir, "entries", "blog", "new.mdx"))).isFile()
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("incremental staging recovers when an asset directory becomes a file", async () => {
  const root = await mkdtemp(join(tmpdir(), "notra-dev-directory-test-"));
  const source = join(root, "source");
  const asset = join(source, "public", "download.md");
  const workDir = join(root, "work");
  await mkdir(asset, { recursive: true });
  await writeFile(join(asset, "nested.txt"), "Old nested asset");
  const options = {
    siteRoot: source,
    workDir,
    incremental: true,
    defaultConfig: createDefaultSiteConfig("Directory replacement"),
  };
  try {
    expect((await prepareSite(options)).validation.ok).toBe(true);
    await rm(asset, { recursive: true });
    await writeFile(asset, "New Markdown asset");
    expect((await prepareSite(options)).validation.ok).toBe(true);
    expect((await prepareSite(options)).validation.ok).toBe(true);
    expect(
      await readFile(join(workDir, "site", "public", "download.md"), "utf8")
    ).toBe("New Markdown asset");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("successful refreshes prune obsolete generated assets without touching current identities or failed previews", async () => {
  const root = await mkdtemp(join(tmpdir(), "notra-dev-generated-test-"));
  const source = join(root, "source");
  const workDir = join(root, "work");
  const publicDir = join(workDir, "site", "public");
  await mkdir(join(source, "blog"), { recursive: true });
  const post = join(source, "blog", "hello.mdx");
  const validPost = '---\ntitle: "Hello"\ndate: 2026-10-12\n---\n\nHello.\n';
  await writeFile(post, validPost);
  await writeFile(join(source, "script.js"), 'document.title = "First";');
  await writeFileEnsured(
    join(publicDir, "_notra", "auth.txt"),
    "Not generated"
  );
  await writeFileEnsured(
    join(publicDir, "_notra", "assets", "manual.js"),
    "Not generated"
  );
  await writeFileEnsured(
    join(publicDir, "_notra", "og", "manual.png"),
    "Not generated"
  );
  let generation = 1;
  let generatedEnabled = true;
  let failOg = false;
  let failPublish = false;
  let failStartup = false;
  let currentScripts: string[] = [];
  let beforeOg = () => Promise.resolve();
  const fontPaths = (version: number) => [
    `/_notra/assets/fonts/${String(version).repeat(64)}/fonts.css`,
    `/_notra/assets/fonts/${String(version).repeat(64)}/font.woff2`,
    `/_notra/assets/fonts/${String(version).repeat(64)}/license.txt`,
  ];
  const ogPath = (version: number) => `/_notra/og/blog/post-${version}.png`;
  const sectionOgPath = "/_notra/og/blog.png";
  const owner = createDevRefresh({
    params: {
      area: "blog",
      mount: "/blog",
      publicOrigin: "http://localhost:4321",
      siteId: "local",
      deploymentId: "local",
      noindex: true,
      includeDrafts: true,
      branding: true,
      workDir,
      mounts: { blog: "/blog" },
    },
    prepare: async () => {
      const prepared = await prepareSite({
        siteRoot: source,
        workDir,
        incremental: true,
        defaultConfig: createDefaultSiteConfig("Generated assets"),
      });
      if (prepared.validation.ok) {
        currentScripts = prepared.customScripts.map(
          (script) => script.fileName
        );
        if (generatedEnabled) {
          for (const path of fontPaths(generation)) {
            await writeFileEnsured(join(publicDir, path), "Current font asset");
          }
          prepared.publicFiles.push(...fontPaths(generation));
          prepared.fontStylesheet = fontPaths(generation)[0];
        }
      }
      return prepared;
    },
    writeOgImages: async (): Promise<OgImagesResult> => {
      if (failOg) {
        throw new Error("OG failed");
      }
      if (!generatedEnabled) {
        return { manifest: {}, diagnostics: [], durationMs: 0 };
      }
      const version = generation;
      await beforeOg();
      await writeFileEnsured(
        join(publicDir, ogPath(version)),
        "Current OG image"
      );
      // Section cards stop once seo.image is set; model that after the first.
      if (version === 1) {
        await writeFileEnsured(
          join(publicDir, sectionOgPath),
          "Current section image"
        );
      }
      return {
        manifest: {
          "blog/hello": ogPath(version),
          ...(version === 1 ? { blog: sectionOgPath } : {}),
        },
        diagnostics: [],
        durationMs: 0,
      };
    },
    publish: (_params, isCurrent) =>
      Promise.resolve(!failPublish && isCurrent()),
    runAstro: (command) =>
      Promise.resolve(command === "dev" && failStartup ? 7 : 0),
    printDiagnostics: () => undefined,
    reportError: () => undefined,
  });
  try {
    expect(await owner.refresh()).toBe(true);
    const originalScript = join(
      publicDir,
      "_notra",
      "assets",
      currentScripts[0] ?? ""
    );
    const originalStat = await stat(originalScript);
    expect(await owner.refresh()).toBe(true);
    expect((await stat(originalScript)).ino).toBe(originalStat.ino);
    expect((await stat(originalScript)).mtimeMs).toBe(originalStat.mtimeMs);
    await writeFile(post, "---\ntitle: [invalid\n---\n");
    expect(await owner.refresh()).toBe(true);
    expect(await readFile(originalScript, "utf8")).toContain("First");
    expect((await stat(join(publicDir, ogPath(1)))).isFile()).toBe(true);
    await writeFile(post, validPost);
    await writeFile(join(source, "script.js"), 'document.title = "Second";');
    generation = 2;
    failOg = true;
    await expect(owner.refresh()).rejects.toThrow("OG failed");
    expect((await stat(originalScript)).isFile()).toBe(true);
    for (const path of fontPaths(1)) {
      expect((await stat(join(publicDir, path))).isFile()).toBe(true);
    }
    failOg = false;
    failPublish = true;
    expect(await owner.refresh()).toBe(false);
    expect((await stat(originalScript)).isFile()).toBe(true);
    failPublish = false;
    failStartup = true;
    await expect(owner.refresh()).rejects.toThrow("Astro dev failed (7)");
    expect((await stat(originalScript)).isFile()).toBe(true);
    expect((await stat(join(publicDir, ogPath(1)))).isFile()).toBe(true);
    failStartup = false;
    expect(await owner.refresh()).toBe(true);
    expect(await stat(originalScript).catch(() => null)).toBeNull();
    expect(await stat(join(publicDir, ogPath(1))).catch(() => null)).toBeNull();
    expect(
      await stat(join(publicDir, sectionOgPath)).catch(() => null)
    ).toBeNull();
    for (const path of fontPaths(1)) {
      expect(await stat(join(publicDir, path)).catch(() => null)).toBeNull();
    }
    const currentScript = join(
      publicDir,
      "_notra",
      "assets",
      currentScripts[0] ?? ""
    );
    expect(await readFile(currentScript, "utf8")).toContain("Second");
    for (const path of [...fontPaths(2), ogPath(2)]) {
      expect((await stat(join(publicDir, path))).isFile()).toBe(true);
    }
    expect(await readFile(join(publicDir, "_notra", "auth.txt"), "utf8")).toBe(
      "Not generated"
    );
    expect(
      await readFile(join(publicDir, "_notra", "assets", "manual.js"), "utf8")
    ).toBe("Not generated");
    expect(
      await readFile(join(publicDir, "_notra", "og", "manual.png"), "utf8")
    ).toBe("Not generated");
    generation = 3;
    await writeFile(
      join(source, "script.js"),
      'document.title = "Superseded";'
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    beforeOg = () => {
      entered.resolve();
      return release.promise;
    };
    const superseded = owner.refresh();
    await entered.promise;
    const supersededScript = join(
      publicDir,
      "_notra",
      "assets",
      currentScripts[0] ?? ""
    );
    await writeFile(post, "---\ntitle: [invalid\n---\n");
    const invalid = owner.refresh();
    release.resolve();
    expect(await superseded).toBe(true);
    expect(await invalid).toBe(true);
    for (const path of [
      currentScript,
      supersededScript,
      join(publicDir, ogPath(2)),
      join(publicDir, ogPath(3)),
    ]) {
      expect((await stat(path)).isFile()).toBe(true);
    }
    beforeOg = () => Promise.resolve();
    await writeFile(post, validPost);
    await rm(join(source, "script.js"));
    generation = 4;
    expect(await owner.refresh()).toBe(true);
    expect(currentScripts).toEqual([]);
    expect(await stat(currentScript).catch(() => null)).toBeNull();
    expect(await stat(supersededScript).catch(() => null)).toBeNull();
    for (const path of [
      ...fontPaths(2),
      ogPath(2),
      ...fontPaths(3),
      ogPath(3),
    ]) {
      expect(await stat(join(publicDir, path)).catch(() => null)).toBeNull();
    }
    for (const path of [...fontPaths(4), ogPath(4)]) {
      expect((await stat(join(publicDir, path))).isFile()).toBe(true);
    }
    generatedEnabled = false;
    expect(await owner.refresh()).toBe(true);
    for (const path of [...fontPaths(4), ogPath(4)]) {
      expect(await stat(join(publicDir, path)).catch(() => null)).toBeNull();
    }
  } finally {
    await owner.shutdown();
    await rm(root, { recursive: true, force: true });
  }
});
