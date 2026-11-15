import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(
  new URL("../../apps/dashboard/package.json", import.meta.url)
);
const { chromium } = require("playwright");

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
if (
  baseUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(baseUrl.hostname)
) {
  throw new Error("Base URL must be plain HTTP on loopback");
}
const output = resolve(
  process.argv[3] ?? ".hoplite/artifacts/benchmarks/dashboard-pages.json"
);
const runs = Number(process.argv[4] ?? 5);
const cpuSlowdown = Number(process.env.CPU_SLOWDOWN ?? 4);
const fixture = JSON.parse(
  readFileSync(
    resolve(".hoplite/artifacts/layout-shift/dashboard-fixture.json"),
    "utf8"
  )
);
if (fixture.cookies.some(({ expires }) => expires <= Date.now() / 1000)) {
  throw new Error("Synthetic fixture expired; rerun setup-dashboard.sh");
}
const paths = (
  process.env.PAGES ?? ",/geo,/content,/chat,/brand/identity,/automation"
).split(",");

const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const observer = () => {
  globalThis.__bench = { lcp: 0, longTasks: [] };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      globalThis.__bench.lcp = entry.startTime;
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      globalThis.__bench.longTasks.push([entry.startTime, entry.duration]);
    }
  }).observe({ type: "longtask", buffered: true });
};

const browser = await chromium.launch();
const samples = [];
try {
  for (let run = 0; run < runs; run++) {
    for (const path of paths) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      await context.addCookies(
        fixture.cookies.map((cookie) => ({
          ...cookie,
          domain: baseUrl.hostname,
        }))
      );
      await context.addInitScript(observer);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown });
      await cdp.send("Performance.enable");
      const scripts = new Map();
      cdp.on("Network.responseReceived", ({ requestId, type, response }) => {
        if (type === "Script") {
          scripts.set(requestId, { url: response.url, bytes: 0 });
        }
      });
      cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
        const script = scripts.get(requestId);
        if (script) {
          script.bytes = encodedDataLength;
        }
      });
      const url = new URL(`/${fixture.slug}${path}`, baseUrl);
      const response = await page.goto(url.href, { waitUntil: "load" });
      if (!response?.ok()) {
        throw new Error(`${url.pathname} returned ${response?.status()}`);
      }
      const finalUrl = new URL(page.url());
      if (
        response.request().redirectedFrom() ||
        finalUrl.origin !== url.origin ||
        finalUrl.pathname !== url.pathname
      ) {
        throw new Error(`${url.pathname} redirected to ${finalUrl.href}`);
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      const bench = await page.evaluate(() => {
        const fcp =
          performance.getEntriesByName("first-contentful-paint")[0]
            ?.startTime ?? 0;
        return { ...globalThis.__bench, fcp };
      });
      const { metrics } = await cdp.send("Performance.getMetrics");
      const metric = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
      samples.push({
        path: path || "/",
        run,
        lcpMs: bench.lcp,
        tbtMs: bench.longTasks
          .filter(([start]) => start >= bench.fcp)
          .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0),
        scriptMs: metric("ScriptDuration") * 1000,
        jsRequests: scripts.size,
        jsTransferBytes: [...scripts.values()].reduce(
          (sum, { bytes }) => sum + bytes,
          0
        ),
        scriptUrls: [...scripts.values()].map(({ url }) => url),
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const summary = paths.map((page) => {
  const path = page === "" ? "/" : page;
  const rows = samples.filter((sample) => sample.path === path);
  return {
    path,
    ...Object.fromEntries(
      ["lcpMs", "tbtMs", "scriptMs", "jsRequests", "jsTransferBytes"].map(
        (key) => [key, Math.round(median(rows.map((row) => row[key])))]
      )
    ),
  };
});
mkdirSync(dirname(output), { recursive: true });
for (const { path, scriptUrls } of samples.filter(({ run }) => run === 0)) {
  writeFileSync(
    output.replace(/\.json$/, `${path.replaceAll("/", "-")}.urls.json`),
    JSON.stringify(scriptUrls)
  );
}
writeFileSync(
  output,
  JSON.stringify(
    { baseUrl: baseUrl.origin, runs, cpuSlowdown, summary, samples },
    null,
    2
  )
);
console.table(summary);
