import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import {
  type Browser,
  chromium,
  expect as browserExpect,
} from "playwright/test";
import { build } from "vite";

import { SITE_FOOTER_HTML } from "./constants/site-footer";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;
const bundleDirectory = mkdtempSync(join(tmpdir(), "notra-site-footer-"));

beforeAll(async () => {
  const output = join(bundleDirectory, "fixture.js");
  execFileSync(process.execPath, [
    "build",
    fileURLToPath(new URL("fixtures/site-footer.tsx", import.meta.url)),
    "--target=browser",
    "--define",
    'process.env.NODE_ENV="production"',
    "--outfile",
    output,
  ]);
  const script = readFileSync(output, "utf8");
  let css = "";
  await build({
    root: fileURLToPath(new URL("..", import.meta.url)),
    configFile: false,
    logLevel: "silent",
    plugins: [
      tailwindcss(),
      {
        name: "footer-fixture-css",
        generateBundle(_options, bundle) {
          for (const asset of Object.values(bundle)) {
            if (asset.type === "asset" && asset.fileName.endsWith(".css")) {
              css += asset.source;
            }
          }
        },
      },
    ],
    build: {
      write: false,
      rolldownOptions: {
        input: fileURLToPath(
          new URL("../src/styles/globals.css", import.meta.url)
        ),
      },
    },
  });
  expect(css.length).toBeGreaterThan(0);
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(script);
      return;
    }
    if (request.url === "/fixture.css") {
      response.setHeader("content-type", "text/css");
      response.end(css);
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end(SITE_FOOTER_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Footer fixture server has no address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 30_000);

afterEach(async () => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

afterAll(async () => {
  await browser?.close();
  server?.close();
  rmSync(bundleDirectory, { recursive: true, force: true });
});

describe.each([
  { width: 835, height: 720 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])("footer at $width px", (viewport) => {
  test.each([false, true])(
    `opening and closing socials preserves footer geometry at ${viewport.width}px (populated: %s)`,
    async (populated) => {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}${populated ? "?populated" : ""}`);
      const trigger = page.getByRole("button", { name: "Add social link" });
      await browserExpect(trigger).toBeVisible();
      const section = page.locator("[data-site-design]");
      const toggle = page.getByRole("switch");
      const sectionBefore = await section.boundingBox();
      const toggleBefore = await toggle.boundingBox();
      if (!(sectionBefore && toggleBefore)) {
        throw new Error("Footer geometry is unavailable");
      }
      const before = [sectionBefore, toggleBefore];
      for (let cycle = 0; cycle < 2; cycle += 1) {
        await trigger.click();
        await browserExpect(page.getByRole("menu")).toBeVisible();
        const frames = await page.evaluate(async () => {
          const samples = [];
          for (let frame = 0; frame < 20; frame += 1) {
            await new Promise(requestAnimationFrame);
            samples.push(
              ["[data-site-design]", "[data-slot=switch]"].map((selector) => {
                const element = document.querySelector(selector);
                if (!element) {
                  throw new Error(`Missing footer element: ${selector}`);
                }
                const box = element.getBoundingClientRect();
                return {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                };
              })
            );
          }
          return samples;
        });
        for (const frame of frames) {
          expect(frame).toEqual(before);
        }
        await page.keyboard.press("Escape");
        await browserExpect(page.getByRole("menu")).toHaveCount(0);
        await browserExpect(trigger).toBeFocused();
        expect([
          await section.boundingBox(),
          await toggle.boundingBox(),
        ]).toEqual(before);
      }
    }
  );
});

test("social menu retains keyboard selection, removal and outside dismissal", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const trigger = page.getByRole("button", { name: "Add social link" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await browserExpect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await browserExpect(
    page.getByRole("textbox", { name: "GitHub", exact: true })
  ).toBeVisible();
  await browserExpect(
    page.locator("[data-slot=dropdown-menu-content]")
  ).toHaveCount(0);
  await trigger.click();
  await browserExpect(page.getByRole("menu")).toBeVisible();
  await browserExpect(
    page.getByRole("menuitem", { name: "GitHub", exact: true })
  ).toHaveCount(0);
  await page.mouse.click(8, 8);
  await browserExpect(
    page.locator("[data-slot=dropdown-menu-content]")
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Remove GitHub" }).click();
  await browserExpect(
    page.getByRole("textbox", { name: "GitHub", exact: true })
  ).toHaveCount(0);
  await trigger.click();
  await browserExpect(
    page.getByRole("menuitem", { name: "GitHub", exact: true })
  ).toBeVisible();
});
