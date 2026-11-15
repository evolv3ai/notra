import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { TURNSTILE_SCRIPT_SRC } from "../src/constants/turnstile";
import {
  DEMO_PRELOAD_BASELINE_STRATEGY,
  DEMO_PRELOAD_HYDRATION_DELAY_MS,
  DEMO_PRELOAD_SAMPLES,
  DEMO_PRELOAD_SCRIPT_DELAY_MS,
  DEMO_PRELOAD_STUB,
} from "./constants/demo-preload";
import type { DemoPreloadSample } from "./types/demo-preload";

const directory = mkdtempSync(join(tmpdir(), "notra-demo-preload-"));

afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("SSR preload overlaps delayed hydration, reuses one fetch, and never executes early", async () => {
  execFileSync(process.execPath, [
    fileURLToPath(new URL("utils/build-demo-preload.mjs", import.meta.url)),
    directory,
  ]);
  const samples: DemoPreloadSample[] = [];
  const browser = await chromium.launch();
  try {
    for (const variant of ["baseline", "preload"]) {
      const { render } = await import(
        join(directory, variant, "bun/demo-preload-server.js")
      );
      const html = render();
      const hint = `<link rel="preload" href="${TURNSTILE_SCRIPT_SRC}" as="script"/>`;
      expect(html.includes(hint)).toBe(variant === "preload");
      expect(render(false)).not.toContain(TURNSTILE_SCRIPT_SRC);
      const script = readFileSync(
        join(directory, variant, "browser/demo-preload-client.js"),
        "utf8"
      );
      const server = createServer((request, response) => {
        if (request.url === "/fixture.js") {
          setTimeout(() => {
            response.setHeader("content-type", "text/javascript");
            response.end(script);
          }, DEMO_PRELOAD_HYDRATION_DELAY_MS);
        } else {
          response.setHeader("content-type", "text/html");
          response.end(html);
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      );
      try {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Demo preload server has no address");
        }
        for (let sample = 0; sample < DEMO_PRELOAD_SAMPLES; sample += 1) {
          const context = await browser.newContext();
          try {
            const page = await context.newPage();
            const errors: string[] = [];
            let requests = 0;
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
              if (message.type() === "error" || message.type() === "warning") {
                errors.push(message.text());
              }
            });
            await page.route(
              "https://challenges.cloudflare.com/**",
              async (route) => {
                requests += 1;
                expect(route.request().url()).toBe(TURNSTILE_SCRIPT_SRC);
                await new Promise((resolve) =>
                  setTimeout(resolve, DEMO_PRELOAD_SCRIPT_DELAY_MS)
                );
                await route.fulfill({
                  contentType: "text/javascript",
                  body: DEMO_PRELOAD_STUB,
                });
              }
            );
            await page.goto(`http://127.0.0.1:${address.port}`);
            await page.waitForFunction(
              () =>
                document.querySelector("output")?.textContent ===
                "synthetic-token"
            );
            const timing = await page.evaluate(
              (src) => ({
                requestStart:
                  performance.getEntriesByName(src)[0]?.startTime ?? -1,
                hydrationStart:
                  performance.getEntriesByName("hydration-start")[0]
                    ?.startTime ?? -1,
                scriptExecuted:
                  performance.getEntriesByName("script-executed")[0]
                    ?.startTime ?? -1,
                widgetReady:
                  performance.getEntriesByName("widget-ready")[0]?.startTime ??
                  -1,
                creationCalls:
                  performance.getEntriesByName("widget-ready").length,
                scriptCrossOrigin: document
                  .querySelector<HTMLScriptElement>(`script[src="${src}"]`)
                  ?.getAttribute("crossorigin"),
                hintCrossOrigin:
                  document
                    .querySelector<HTMLLinkElement>(`link[href="${src}"]`)
                    ?.getAttribute("crossorigin") ?? null,
              }),
              TURNSTILE_SCRIPT_SRC
            );
            expect(requests).toBe(1);
            expect(timing.creationCalls).toBe(1);
            expect(timing.scriptCrossOrigin).toBeNull();
            expect(timing.hintCrossOrigin).toBeNull();
            expect(timing.requestStart).toBeGreaterThan(0);
            expect(timing.requestStart < timing.hydrationStart).toBe(
              variant === "preload"
            );
            expect(timing.scriptExecuted).toBeGreaterThanOrEqual(
              timing.hydrationStart
            );
            expect(errors).toEqual([]);
            samples.push({ variant, sample, requests, ...timing });
          } finally {
            await context.close();
          }
        }
      } finally {
        server.close();
      }
    }
    const medians = Object.fromEntries(
      ["baseline", "preload"].map((variant) => {
        const times = samples
          .filter((sample) => sample.variant === variant)
          .map((sample) => sample.widgetReady)
          .sort((a, b) => a - b);
        return [variant, times[Math.floor(times.length / 2)] ?? 0];
      })
    );
    const report = {
      hydrationDelayMs: DEMO_PRELOAD_HYDRATION_DELAY_MS,
      scriptDelayMs: DEMO_PRELOAD_SCRIPT_DELAY_MS,
      baselineStrategy: DEMO_PRELOAD_BASELINE_STRATEGY,
      samples,
      medians,
    };
    const artifact =
      process.env.DEMO_PRELOAD_REPORT ?? join(directory, "measurement.json");
    writeFileSync(artifact, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    expect(medians.preload).toBeLessThan(medians.baseline ?? 0);
  } finally {
    await browser.close();
  }
}, 30_000);
