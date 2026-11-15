import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = createRequire(path.join(web, "../dashboard/package.json"))(
  "playwright"
);
const sharp = createRequire(path.join(web, "package.json"))("sharp");
const [mode, origin, output] = process.argv.slice(2);
const control = process.argv.includes("--control");
const onlyRoute = process.argv
  .find((argument) => argument.startsWith("--route="))
  ?.slice(8);
const chrome = process.argv
  .find((argument) => argument.startsWith("--chrome="))
  ?.slice(9);
assert.ok(
  ["capture", "compare"].includes(mode) && origin && output,
  "Usage: node scripts/fonts/verify.mjs capture|compare http://127.0.0.1:PORT OUTPUT"
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome || "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const routes = [
  "/",
  "/brand",
  "/features/conversations",
  "/integrations/github",
  "/blog/how-to-build-a-muse-connector",
  "/state-of-ai-search/email-api/2026-10",
  "/state-of-ai-search/changelog/2026-10",
];
routes.push("/__font-probe");
const stabilize =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}video,canvas{visibility:hidden!important}";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const records = [];
const differences = [];
const stylesheets = new Map();

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function probe() {
  const html = await fetchText(`${origin}/brand`);
  const stylesheet = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/.exec(
    html
  )[1];
  const sample =
    "AV To Té Të Tà ÅV Vé Wö fï ffi fi fl café naïve façade Straße Łódź Český Œuvre — ‘quotes’ “quotes” … · © ® ™ € ↑ ↓ − a\u0308 e\u0301 ſ\u0300\u0301\u0303 Σπ π\u0301 U+2010: ‐ soft: co\u00adoperate 日本語 中文 한국어";
  const inventory = JSON.parse(
    await readFile(new URL("inventory.json", import.meta.url), "utf8")
  );
  const characters = [
    ...new Set(
      Object.entries(inventory.after)
        .filter(([name]) => name !== "Satoshi-Variable.woff2")
        .flatMap(([, font]) =>
          font.unicodeRange.split(",").flatMap((range) => {
            const [start, end] = range
              .slice(2)
              .split("-")
              .map((part) => Number.parseInt(part, 16));
            return Array.from(
              { length: (end ?? start) - start + 1 },
              (_, index) => String.fromCodePoint(start + index)
            );
          })
        )
    ),
  ]
    .join("")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  let body =
    "<h1>Font regression specimen</h1><p>Identical synthetic content supplements the production-page snapshots.</p>";
  for (const family of ["Inter Variable", "Instrument Serif", "Satoshi"]) {
    for (const weight of family === "Instrument Serif"
      ? [400, 700]
      : [300, 400, 500, 600, 700]) {
      for (const size of [12, 16, 24, 48]) {
        body += `<section style="font-family:'${family}';font-weight:${weight};font-size:${size}px"><div>${family} ${weight}/${size} ${sample}</div><em>Italic <strong style="font-weight:700">bold inside italics</strong> ${sample}</em></section>`;
      }
    }
    body += `<p style="font-family:'${family}';font-size:20px">${characters}</p><p style="font-family:'${family}';font-variant-numeric:tabular-nums;font-size:24px">0123456789 11111 00000 123.45</p>`;
  }
  body += `<p style="font-family:Inter,sans-serif;font-weight:600">Inline Inter alias: ${sample}</p><p style="font-family:var(--font-mono)"><code>const count = 123; // code stays system monospace</code></p><p lang="de" style="font-family:'Inter Variable';hyphens:auto;width:110px">Donaudampfschifffahrtsgesellschaft co\u00adoperate</p><p style="font-family:'Inter Variable';font-synthesis:none"><em>Suppressed synthesis <strong>bold italic</strong> ${sample}</em></p><p style="font-family:'Inter Variable';font-kerning:none;font-variant-ligatures:none">No kerning or ligatures: AV ffi office</p>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="${stylesheet}"><style>${stabilize}body{padding:24px;overflow-wrap:anywhere}section{margin-block:24px}p{margin-block:16px}</style></head><body>${body}</body></html>`;
}

async function context(scale = 1) {
  const current = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: scale,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
  });
  await current.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.protocol === "data:"
      ? route.continue()
      : route.abort();
  });
  return current;
}

async function measure(route) {
  const current = await context();
  const page = await current.newPage();
  const fonts = new Map();
  const responses = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "font") {
      responses.push(
        (async () => {
          assert.equal(response.status(), 200, response.url());
          fonts.set(
            new URL(response.url()).pathname,
            (await response.body()).length
          );
        })()
      );
    }
  });
  const response = await page.goto(origin + route, {
    waitUntil: "networkidle",
  });
  assert.equal(response.status(), 200, route);
  await page.addStyleTag({ content: stabilize });
  await page.evaluate(async () => {
    for (const image of document.images) {
      image.loading = "eager";
    }
    for (let y = 0; y < document.body.scrollHeight; y += 800) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(1000);
  await Promise.all(responses);
  const preloads = await page
    .locator('link[rel="preload"][as="font"]')
    .evaluateAll((links) =>
      links.map((link) => ({
        href: new URL(link.href).pathname,
        crossOrigin: link.crossOrigin,
        type: link.type,
      }))
    );
  const usage = await page.evaluate(() => {
    const entries = new Map();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    while (walker.nextNode()) {
      const element = walker.currentNode.parentElement;
      if (
        !walker.currentNode.textContent.trim() ||
        ["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)
      ) {
        continue;
      }
      const style = getComputedStyle(element);
      const settings = Object.fromEntries(
        [
          "fontFamily",
          "fontWeight",
          "fontStyle",
          "fontFeatureSettings",
          "fontVariationSettings",
          "fontVariantNumeric",
          "fontVariantLigatures",
          "fontKerning",
          "fontSynthesis",
          "hyphens",
        ].map((name) => [name, style[name]])
      );
      entries.set(JSON.stringify(settings), {
        ...settings,
        sample: walker.currentNode.textContent.slice(0, 100),
      });
    }
    return [...entries.values()];
  });
  const html = await page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true);
    for (const script of clone.querySelectorAll("script")) {
      script.remove();
    }
    return `<!DOCTYPE html>${clone.outerHTML}`;
  });
  await current.close();
  return {
    route,
    fonts: Object.fromEntries(fonts),
    bytes: [...fonts.values()].reduce((a, b) => a + b, 0),
    preloads,
    usage,
    html,
  };
}

async function render(
  html,
  css,
  preloads,
  name,
  width,
  scale,
  baselineOrigin = origin
) {
  const current = await context(scale);
  const page = await current.newPage();
  await page.setViewportSize({ width, height: 1000 });
  const content = html
    .replace(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*>/g, "")
    .replace(
      "<head>",
      `<head>${preloads.map((font) => `<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="${font.href}">`).join("")}`
    );
  await page.route("**/__font_snapshot__", (route) =>
    route.fulfill({ contentType: "text/html", body: content })
  );
  if (css) {
    await page.route("**/*.css", async (route) => {
      const url = baselineOrigin + new URL(route.request().url()).pathname;
      if (!stylesheets.has(url)) {
        stylesheets.set(url, await fetchText(url));
      }
      const baseline = stylesheets.get(url);
      await route.fulfill({
        contentType: "text/css",
        body: baseline.includes("@font-face")
          ? baseline.replace(/@font-face\s*\{[^}]+\}/g, "") + css
          : baseline,
      });
    });
  }
  await page.goto(`${origin}/__font_snapshot__`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    for (const image of document.images) {
      image.loading = "eager";
    }
    await document.fonts.ready;
  });
  await page.waitForTimeout(250);
  let screenshot;
  for (let frame = 0; frame < (mode === "capture" ? 3 : 1); frame++) {
    const image = await page.screenshot({
      fullPage: true,
      animations: "disabled",
      scale: "device",
    });
    screenshot ??= image;
    await writeFile(
      path.join(
        output,
        `${name}-${width}-${scale}${frame ? `-control-${frame}` : ""}.png`
      ),
      image
    );
  }
  await current.close();
  return { screenshot };
}

async function checkRanges(css) {
  const results = [];
  for (const family of ["Inter Variable", "Instrument Serif"]) {
    for (const [scenario, text] of [
      ["core", "ASCII ‘quotes’ — … ·"],
      ["latin1", "Té ÅV café"],
      ["extended", "Té ÅV café Łódź"],
      ["cjk", "ASCII 日本語 中文 한국어"],
    ]) {
      const current = await context();
      const page = await current.newPage();
      const fonts = new Map();
      const responses = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "font") {
          responses.push(
            (async () =>
              fonts.set(
                new URL(response.url()).pathname,
                (await response.body()).length
              ))()
          );
        }
      });
      await page.route("**/__font_ranges__", (route) =>
        route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: `<!DOCTYPE html><meta charset="utf-8"><style>${css}</style><span id="sample" style="font:24px '${family}'">${text}</span>`,
        })
      );
      await page.goto(`${origin}/__font_ranges__`, {
        waitUntil: "networkidle",
      });
      await page.evaluate(() => document.fonts.ready);
      await Promise.all(responses);
      const session = await current.newCDPSession(page);
      await session.send("DOM.enable");
      await session.send("CSS.enable");
      const { root } = await session.send("DOM.getDocument");
      const { nodeId } = await session.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: "#sample",
      });
      const platform = await session.send("CSS.getPlatformFontsForNode", {
        nodeId,
      });
      if (mode === "compare" && !control) {
        assert.equal(
          [...fonts.keys()].some((url) => url.includes("extended")),
          scenario === "extended",
          `${family}: ${scenario}`
        );
        assert.equal(
          fonts.size,
          scenario === "extended" ? 2 : 1,
          `${family}: ${scenario}`
        );
      }
      results.push({
        family,
        scenario,
        text,
        fonts: Object.fromEntries(fonts),
        bytes: [...fonts.values()].reduce((a, b) => a + b, 0),
        platformFonts: platform.fonts,
      });
      await current.close();
    }
  }
  return results;
}

try {
  let baselineOrigin;
  const rootHtml = await fetchText(`${origin}/brand`);
  const stylesheet = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/.exec(
    rootHtml
  )[1];
  const currentCss = await fetchText(origin + stylesheet);
  const currentFaces = currentCss
    .match(/@font-face\s*\{[^}]+\}/g)
    .join("\n")
    .replace(
      /url\(([^)]+)\)/g,
      (_, url) => `url(${origin}${url.replace(/^['"]|['"]$/g, "")})`
    );
  const fontCss = currentFaces;
  assert.ok(
    !currentFaces.includes("data:"),
    "Fonts must remain external for unicode-range to defer their downloads"
  );
  if (mode === "compare") {
    const baseline = JSON.parse(
      await readFile(path.join(output, "baseline.json"), "utf8")
    );
    baselineOrigin = baseline.origin;
    assert.equal(
      hash(currentCss.replace(/@font-face\s*\{[^}]+\}/g, "")),
      baseline.nonFontCssSha256,
      "Non-font production CSS must be identical"
    );
  }
  for (const [index, route] of routes.entries()) {
    if (onlyRoute && route !== onlyRoute) {
      continue;
    }
    const actual =
      route === "/__font-probe"
        ? {
            route,
            fonts: {},
            bytes: 0,
            preloads: [],
            html: mode === "capture" ? await probe() : "",
          }
        : await measure(route);
    if (route !== "/__font-probe") {
      if (mode === "compare" && !control) {
        assert.equal(
          actual.preloads.length,
          route === "/brand" ? 2 : 1,
          `${route}: core font preloads`
        );
        assert.ok(
          actual.preloads.some((font) => font.href.includes("inter-core")),
          `${route}: Inter preload`
        );
        assert.ok(
          actual.preloads.every(
            (font) =>
              !font.href.includes("extended") &&
              font.crossOrigin === "anonymous"
          ),
          `${route}: preload only anonymous core fonts`
        );
      }
      records.push({ ...actual, html: undefined });
    }
    const name = `page-${index}`;
    const htmlPath = path.join(output, `${name}.html`);
    if (mode === "capture") {
      await writeFile(htmlPath, actual.html);
    }
    const html = await readFile(htmlPath, "utf8");
    for (const [width, scale] of [
      [1440, 1],
      [390, 1],
      [1440, 2],
      [390, 2],
    ]) {
      const rendered = await render(
        html,
        fontCss,
        actual.preloads,
        `${mode}-${name}`,
        width,
        scale,
        baselineOrigin
      );
      if (mode === "compare") {
        const after = await sharp(rendered.screenshot)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const controls = [];
        let best;
        for (let frame = 0; frame < 3; frame++) {
          const baseline = await readFile(
            path.join(
              output,
              `capture-${name}-${width}-${scale}${frame ? `-control-${frame}` : ""}.png`
            )
          );
          const before = await sharp(baseline)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          assert.deepEqual(before.info, after.info, `${route} dimensions`);
          let pixels = 0;
          let maxChannelDelta = 0;
          const diff = Buffer.alloc(before.data.length);
          for (let i = 0; i < diff.length; i += 4) {
            let changed = false;
            for (let c = 0; c < 4; c++) {
              const delta = Math.abs(before.data[i + c] - after.data[i + c]);
              maxChannelDelta = Math.max(maxChannelDelta, delta);
              changed ||= delta !== 0;
            }
            if (changed) {
              pixels++;
              diff[i] = 255;
            }
            diff[i + 3] = 255;
          }
          controls.push({ frame, pixels, maxChannelDelta });
          if (!best || pixels < best.pixels) {
            best = { frame, pixels, maxChannelDelta, diff };
          }
        }
        await sharp(best.diff, { raw: after.info })
          .png()
          .toFile(path.join(output, `diff-${name}-${width}-${scale}.png`));
        differences.push({
          route,
          width,
          scale,
          height: after.info.height,
          pixels: best.pixels,
          maxChannelDelta: best.maxChannelDelta,
          controlFrame: best.frame,
          controls,
          htmlSha256: hash(html),
        });
      }
    }
    console.log(route, actual.bytes, actual.fonts);
  }
  const rangeTests = await checkRanges(currentFaces);
  await writeFile(
    path.join(output, mode === "capture" ? "baseline.json" : "after.json"),
    `${JSON.stringify({ origin, baselineOrigin, browser: browser.version(), nonFontCssSha256: hash(currentCss.replace(/@font-face\s*\{[^}]+\}/g, "")), records, differences, rangeTests }, null, 2)}\n`
  );
  if (differences.some((diff) => diff.pixels !== 0)) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
