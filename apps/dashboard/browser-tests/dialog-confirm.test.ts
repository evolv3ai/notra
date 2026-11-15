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

import { type Browser, chromium } from "playwright";

import { DIALOG_CONFIRM_HTML } from "./constants/dialog-confirm";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;
const bundleDirectory = mkdtempSync(join(tmpdir(), "notra-dialog-confirm-"));

beforeAll(async () => {
  const output = join(bundleDirectory, "fixture.js");
  execFileSync(process.execPath, [
    "build",
    fileURLToPath(new URL("fixtures/dialog-confirm.tsx", import.meta.url)),
    "--target=browser",
    "--define",
    'process.env.NODE_ENV="production"',
    "--outfile",
    output,
  ]);
  const script = readFileSync(output, "utf8");
  server = createServer((request, response) => {
    const javascript = request.url === "/fixture.js";
    response.setHeader(
      "content-type",
      javascript ? "text/javascript" : "text/html"
    );
    response.end(javascript ? script : DIALOG_CONFIRM_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Browser fixture server has no address");
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

describe.each(["dialog", "sheet"])("%s", (mode) => {
  test.each(["Meta", "Control"])(
    "%s+Enter respects native validation and submits exactly once",
    async (modifier) => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}?${mode}`);
      const draft = page.getByRole("textbox", { name: "Draft", exact: true });
      const count = page.getByTestId("submissions");
      await draft.press(`${modifier}+Enter`);
      expect(await count.textContent()).toBe("0");
      expect(
        await page
          .getByRole("textbox", { name: "Required field" })
          .evaluate((input: HTMLInputElement) => input.validity.valueMissing)
      ).toBe(true);

      await page.getByRole("textbox", { name: "Required field" }).fill("Valid");
      await draft.press(`${modifier}+Enter`);
      expect(await count.textContent()).toBe("1");
      await draft.press("Enter");
      expect(await draft.inputValue()).toBe("\n");
      expect(await count.textContent()).toBe("1");
    }
  );

  test("disabled and busy buttons block native submission", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}?${mode}`);
    const required = page.getByRole("textbox", { name: "Required field" });
    await required.fill("Valid");
    for (const label of ["Disable save", "Save busy"]) {
      await page.getByLabel(label).check();
      await required.press("Meta+Enter");
      expect(await page.getByTestId("submissions").textContent()).toBe("0");
      await page.getByLabel(label).uncheck();
    }
    await required.press("Control+Enter");
    expect(await page.getByTestId("submissions").textContent()).toBe("1");
  });

  test("nested dialogs confirm only their own action", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}?${mode}`);
    await page.getByRole("textbox", { name: "Required field" }).fill("Valid");
    await page.getByRole("button", { name: "Open child" }).click();
    await page
      .getByRole("textbox", { name: "Child draft" })
      .press("Meta+Enter");
    expect(await page.getByTestId("child-submissions").textContent()).toBe("1");
    expect(await page.getByTestId("submissions").textContent()).toBe("0");
    await page.keyboard.press("Escape");
    await page
      .getByRole("textbox", { name: "Draft", exact: true })
      .press("Control+Enter");
    expect(await page.getByTestId("submissions").textContent()).toBe("1");
  });
});
