import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateCls } from "./utils/calculate-cls.mjs";
import { validateDashboardSnapshot } from "./utils/validate-dashboard.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const parsedBaseUrl = new URL(baseUrl);
if (
  parsedBaseUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(parsedBaseUrl.hostname) ||
  parsedBaseUrl.username ||
  parsedBaseUrl.password
) {
  throw new Error(
    "Base URL must use HTTP on 127.0.0.1 or localhost without authentication"
  );
}
const output = resolve(
  process.argv[3] ?? ".hoplite/artifacts/layout-shift/cold-load"
);
const repetitions = Number(process.argv[4] ?? 3);
if (!Number.isSafeInteger(repetitions) || repetitions < 1) {
  throw new Error("Repetitions must be a finite positive integer");
}
const session = `cls-load-${crypto.randomUUID()}`;
mkdirSync(output, { recursive: true });
const fixture = JSON.parse(
  readFileSync(
    resolve(".hoplite/artifacts/layout-shift/dashboard-fixture.json"),
    "utf8"
  )
);
if (
  !Array.isArray(fixture.cookies) ||
  fixture.cookies.length === 0 ||
  fixture.cookies.some(
    ({ expires }) => !Number.isFinite(expires) || expires <= Date.now() / 1000
  )
) {
  throw new Error(
    "Synthetic fixture is missing or expired; rerun fixture setup"
  );
}
const slug = fixture.slug;
const paths = [
  "",
  "/geo",
  "/geo/traffic",
  "/geo/prompts",
  "/geo/personas",
  "/geo/competitors",
  "/geo/shelf-space",
  "/geo/gaps",
  "/geo/agent-readiness",
  "/content",
  "/chat",
  "/feedback",
  "/brand/identity",
  "/automation",
  "/automation/runs",
  "/integrations",
  "/skills",
  "/api-keys",
];

function browser(...args) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
    timeout: 120_000,
  }).trim();
}

browser("open", "about:blank");
const socket = new WebSocket(browser("get", "cdp-url"));
const results = [];
try {
  await new Promise((resolveOpen, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CDP connection timed out")),
      30_000
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolveOpen();
      },
      { once: true }
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("CDP connection failed"));
      },
      { once: true }
    );
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        reject(new Error("CDP connection closed"));
      },
      { once: true }
    );
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) {
      request.reject(new Error(JSON.stringify(message.error)));
    } else {
      request.resolve(message.result);
    }
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("CDP connection closed"));
    }
    pending.clear();
  });
  const cdp = (method, params, sessionId) => {
    const id = ++nextId;
    return new Promise((resolveCommand, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error("CDP connection is not open"));
        return;
      }
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP request timed out: ${method}`));
      }, 30_000);
      pending.set(id, { resolve: resolveCommand, reject, timer });
      try {
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  };

  const { targetInfos } = await cdp("Target.getTargets", {});
  const target = targetInfos.find(
    ({ type, url }) => type === "page" && url === "about:blank"
  );
  const { sessionId } = await cdp("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Network.enable", {}, sessionId);
  await cdp("Network.setCookies", { cookies: fixture.cookies }, sessionId);
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
  await cdp("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  await cdp(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `window.__layoutShifts = []; new PerformanceObserver(list => {
    for (const entry of list.getEntries()) window.__layoutShifts.push({
      value: entry.value, startTime: entry.startTime, hadRecentInput: entry.hadRecentInput,
      sources: (entry.sources || []).map(source => ({
        node: source.node ? source.node.tagName.toLowerCase() + (source.node.id ? '#' + source.node.id : '') + '.' + [...source.node.classList].slice(0, 5).join('.') : null,
        previousRect: source.previousRect.toJSON(), currentRect: source.currentRect.toJSON()
      }))
    });
  }).observe({type: 'layout-shift', buffered: true});`,
    },
    sessionId
  );

  const measure = (name, profile, run, expectedPath) => {
    const result = JSON.parse(
      browser(
        "--json",
        "eval",
        `({shell: !!document.querySelector('[data-dashboard-shell]'), url: location.pathname, title: document.title, shifts: window.__layoutShifts, fontsLoaded: document.fonts.status, viewport: {width: innerWidth, height: innerHeight}, overflow: document.documentElement.scrollWidth > innerWidth, headings: [...document.querySelectorAll("h1,h2")].map(n=>n.textContent), skeletons: document.querySelectorAll('main [data-slot="skeleton"]').length})`
      )
    );
    if (!result.success) {
      throw new Error(JSON.stringify(result));
    }
    const data = result.data.result;
    validateDashboardSnapshot(data, expectedPath);
    const cls = calculateCls(data.shifts);
    const row = {
      name,
      profile,
      run,
      cls,
      totalShift: data.shifts.reduce((sum, shift) => sum + shift.value, 0),
      ...data,
    };
    if (run === 1) {
      browser("screenshot", resolve(output, `${profile}-${name}.png`));
    }
    console.log(
      JSON.stringify({
        name,
        profile,
        run,
        cls: Number(cls.toFixed(6)),
        totalShift: Number(row.totalShift.toFixed(6)),
        entries: data.shifts.length,
      })
    );
    return row;
  };

  for (const profile of ["desktop", "mobile"]) {
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      profile === "desktop"
        ? { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
        : { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
      sessionId
    );
    await cdp(
      "Emulation.setCPUThrottlingRate",
      { rate: profile === "mobile" ? 4 : 1 },
      sessionId
    );
    for (let run = 1; run <= repetitions; run++) {
      for (const path of paths) {
        const name = path.slice(1).replaceAll("/", "-") || "home";
        await cdp("Network.clearBrowserCache", {}, sessionId);
        browser("open", new URL(`/${slug}${path}`, baseUrl).href);
        await cdp("Page.bringToFront", {}, sessionId);
        await new Promise((resolveWait) => setTimeout(resolveWait, 6000));
        // Throttled mobile loads can still be fetching fonts after the window.
        browser(
          "eval",
          "document.fonts.ready.then(() => document.fonts.status)"
        );
        results.push(measure(name, profile, run, `/${slug}${path}`));
      }
    }
  }
} finally {
  try {
    writeFileSync(
      resolve(output, "results.json"),
      JSON.stringify(
        {
          baseUrl,
          repetitions,
          observationMs: 6000,
          cache: "disabled and cleared before each document load",
          cpu: { desktop: 1, mobile: 4 },
          network: "unthrottled loopback network",
          results,
        },
        null,
        2
      )
    );
  } finally {
    socket.close();
    browser("close");
  }
}
