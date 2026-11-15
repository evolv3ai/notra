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

import { MENU_HIGHLIGHT_HTML } from "./constants/menu-highlight";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;
const bundleDirectory = mkdtempSync(join(tmpdir(), "notra-menu-highlight-"));

beforeAll(async () => {
  const output = join(bundleDirectory, "fixture.js");
  execFileSync(process.execPath, [
    "build",
    fileURLToPath(new URL("fixtures/menu-highlight.tsx", import.meta.url)),
    "--target=browser",
    "--define",
    'process.env.NODE_ENV="production"',
    "--outfile",
    output,
  ]);
  const script = readFileSync(output, "utf8");
  const stylesheets = new Map<string, string>();
  for (const theme of ["dashboard", "web"]) {
    let css = "";
    const root = fileURLToPath(new URL(`../../${theme}/`, import.meta.url));
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [
        tailwindcss(),
        {
          name: "menu-highlight-fixture-css",
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
        rolldownOptions: { input: join(root, "src/styles/globals.css") },
      },
    });
    expect(css.length).toBeGreaterThan(0);
    stylesheets.set(`/${theme}.css`, css);
  }
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/fixture.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(script);
      return;
    }
    const stylesheet = stylesheets.get(url.pathname);
    if (stylesheet) {
      response.setHeader("content-type", "text/css");
      response.end(stylesheet);
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end(
      MENU_HIGHLIGHT_HTML.replace(
        "__THEME_CLASS__",
        url.searchParams.has("dark") ? "dark" : ""
      ).replace("__STYLESHEET__", `${url.pathname}.css`)
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Browser fixture server has no address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 60_000);

afterEach(async () => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

afterAll(async () => {
  await browser?.close();
  server?.close();
  rmSync(bundleDirectory, { recursive: true, force: true });
});

describe.each(["dashboard", "web"])("%s menu highlights", (theme) => {
  test.each([false, true])("dropdown highlight, dark=%s", async (dark) => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/${theme}${dark ? "?dark" : ""}`);
    await page.getByRole("button", { name: "Open menu" }).click();
    const item = page.getByRole("menuitem", { name: "Prompts", exact: true });
    await item.hover();
    await browserExpect(item).toHaveCSS(
      "background-color",
      dark ? /\/ 0\.07\)/ : /\/ 0\.05\)/
    );
    if (dark) {
      await browserExpect(item).toHaveCSS("box-shadow", /inset/);
    }
  });

  test.each([false, true])(
    "open submenu stays highlighted, dark=%s",
    async (dark) => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/${theme}${dark ? "?dark" : ""}`);
      await page.getByTestId("context-trigger").click({ button: "right" });
      const trigger = page.getByRole("menuitem", { name: "More", exact: true });
      await trigger.hover();
      const child = page.getByRole("menuitem", {
        name: "Child action",
        exact: true,
      });
      await child.hover();
      await browserExpect(trigger).toHaveAttribute("data-popup-open", "");
      await browserExpect(child).toBeFocused();
      await browserExpect(trigger).not.toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)"
      );
      if (dark) {
        await browserExpect(trigger).toHaveCSS(
          "background-color",
          /\/ 0\.07\)/
        );
        await browserExpect(trigger).toHaveCSS("box-shadow", /inset/);
      }
    }
  );
});
