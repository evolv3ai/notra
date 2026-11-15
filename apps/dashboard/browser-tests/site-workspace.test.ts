import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import {
  type Browser,
  chromium,
  expect as browserExpect,
} from "playwright/test";

import { SITE_WORKSPACE_HTML } from "./constants/site-workspace";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;

beforeAll(async () => {
  const fixture = fileURLToPath(
    new URL("fixtures/site-workspace.tsx", import.meta.url)
  );
  const script = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("utils/build-site-workspace.mjs", import.meta.url)),
      fixture,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  server = createServer((request, response) => {
    const javascript = request.url === "/fixture.js";
    response.setHeader(
      "content-type",
      javascript ? "text/javascript" : "text/html"
    );
    response.end(javascript ? script : SITE_WORKSPACE_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No fixture address");
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
});

test("switching between cached sites replaces the config and variable buffers", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("");
  await page.getByRole("button", { name: "Switch site" }).click();
  await browserExpect(name).toHaveValue("site-b");
  await browserExpect(page.getByLabel("Value of variable 1")).toHaveValue(
    "site-b"
  );
  await name.fill("Edited B");
  await page.getByRole("button", { name: "Flush", exact: true }).click();
  await browserExpect(page.getByTestId("status")).toHaveText(/^(idle|saved)$/);
  expect(
    JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}")
  ).toMatchObject({
    name: "Edited B",
    description: "site-b description",
    variables: { product_name: "site-b" },
  });
  await page.getByRole("button", { name: "Switch site" }).click();
  await browserExpect(name).toHaveValue("site-a");
});

test("changing organization replaces the workspace even with the same site and branch", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("");
  const owner = await page.getByTestId("owner").textContent();
  await page.getByRole("button", { name: "Switch organization" }).click();
  await browserExpect(
    page.getByRole("textbox", { name: "Name", exact: true })
  ).toHaveValue("site-a");
  expect(await page.getByTestId("owner").textContent()).not.toBe(owner);
});

test("invalid fields survive moving between pages of the same site", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  const navigation = page.getByTestId("navigation");
  const go = (label: string) =>
    page.getByRole("button", { name: label, exact: true }).click();
  await name.fill("");
  await browserExpect(page.getByRole("alert").first()).toContainText(
    "Some fields need fixing"
  );
  await go("Open Styling");
  await browserExpect(navigation).toHaveText("Styling");
  await browserExpect(name).toHaveCount(0);
  await go("Open Settings page");
  await browserExpect(navigation).toHaveText("Settings page");
  await browserExpect(page.locator("[data-site-design]")).toHaveCount(0);
  await go("Open General");
  await browserExpect(navigation).toHaveText("General");
  await browserExpect(name).toHaveValue("");
  for (const label of [
    "Navigate away",
    "Open another branch",
    "Open another project",
  ]) {
    await go(label);
    await browserExpect(navigation).toHaveText("blocked");
  }
  await browserExpect(name).toHaveValue("");
});

test("an invalid config from the repository names its fields, never blocks leaving, and repairs into a draft", async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}?broken`);
  const alert = page.getByRole("alert").first();
  await browserExpect(alert).toContainText(
    "blog.json in your repository has errors"
  );
  await browserExpect(alert).toContainText("footer.socials.x");
  await page
    .getByRole("button", { name: "Navigate away", exact: true })
    .click();
  await browserExpect(page.getByTestId("navigation")).toHaveText("left");
  await page.getByRole("button", { name: "Repair", exact: true }).click();
  await browserExpect(
    page.getByText("blog.json in your repository has errors")
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Flush", exact: true }).click();
  await browserExpect(page.getByTestId("status")).toHaveText(/^(idle|saved)$/);
  expect(
    JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}")
  ).toEqual({
    name: "site-a",
    description: "site-a description",
    variables: { product_name: "site-a" },
    colors: {},
    footer: { socials: {} },
    redirects: [{ source: "/old", destination: "/new" }],
  });
});

test("image uploads keep pages of the same site blocked until they finish", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await browserExpect(name).toHaveValue("site-a");
  await page.getByRole("button", { name: "Start upload" }).click();
  await page.getByRole("button", { name: "Open Styling" }).click();
  await browserExpect(page.getByTestId("navigation")).toHaveText("blocked");
  await browserExpect(name).toHaveValue("site-a");
  await page.getByRole("button", { name: "Finish upload" }).click();
  await page.getByRole("button", { name: "Open Styling" }).click();
  await browserExpect(page.getByTestId("navigation")).toHaveText("Styling");
});

test("a cold Settings variables form loads quietly before workspace queries finish", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}?cold`);
  await browserExpect(page.getByText("Loading design…")).toBeVisible();
  expect(await page.getByRole("textbox").count()).toBe(0);
  await page.getByRole("button", { name: "Finish load" }).click();
  await browserExpect(page.getByLabel("Name of variable 1")).toHaveValue(
    "product_name"
  );
  expect(errors).toEqual([]);
});

test("dismissed rebases block edits and retain the owner through query resets", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  await browserExpect(
    page.getByRole("textbox", { name: "Name", exact: true })
  ).toHaveValue("site-a");
  const owner = await page.getByTestId("owner").textContent();
  const config = await page.getByTestId("config").textContent();
  await page.getByRole("button", { name: "Hold rebase" }).click();
  await page.getByRole("button", { name: "Open publish" }).click();
  await page.getByRole("button", { name: "Start rebase" }).click();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  expect(
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .evaluate((element) => Boolean(element.closest("[inert]")))
  ).toBe(true);
  await page
    .getByRole("button", { name: "Attempt edits" })
    .evaluate((button: HTMLButtonElement) => button.click());
  expect(await page.getByTestId("config").textContent()).toBe(config);
  await page.getByRole("button", { name: "Finish rebase" }).click();
  await browserExpect(page.getByTestId("fetching")).not.toHaveText("0");
  expect(await page.getByTestId("owner").textContent()).toBe(owner);
  await page.getByRole("button", { name: "Finish load" }).click();
  await browserExpect(page.getByTestId("fetching")).toHaveText("0");
  await browserExpect(page.locator("[inert]")).toHaveCount(0);
  expect(await page.getByTestId("owner").textContent()).toBe(owner);
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("After rebase");
  await page.getByRole("button", { name: "Flush", exact: true }).click();
  await browserExpect(page.getByTestId("status")).toHaveText(/^(idle|saved)$/);
});

test("query resets preserve pending buffers and resume their autosave", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Pending edit");
  const owner = await page.getByTestId("owner").textContent();
  await page.getByRole("button", { name: "Hold rebase" }).click();
  await page.getByRole("button", { name: "Reset document" }).click();
  await browserExpect(page.locator("[inert]")).toHaveCount(2);
  expect(await page.getByTestId("owner").textContent()).toBe(owner);
  expect(
    JSON.parse((await page.getByTestId("config").textContent()) ?? "{}").name
  ).toBe("Pending edit");
  await page.getByRole("button", { name: "Restore document" }).click();
  await browserExpect(page.getByTestId("status")).toHaveText(/^(idle|saved)$/);
  expect(
    JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}").name
  ).toBe("Pending edit");
});

test.each([false, true])(
  "clean snapshots adopt teammate revisions (previous save: %s)",
  async (previousSave) => {
    const page = await browser.newPage();
    await page.goto(baseUrl);
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    await browserExpect(name).toHaveValue("site-a");
    if (previousSave) {
      await name.fill("First edit");
      await page.getByRole("button", { name: "Flush", exact: true }).click();
      await browserExpect(page.getByTestId("persisted")).toContainText(
        "First edit"
      );
    }
    await page.getByRole("button", { name: "Teammate refresh" }).click();
    await browserExpect(
      page.getByRole("textbox", { name: "Description", exact: true })
    ).toHaveValue("Teammate description");
    await browserExpect(page.getByLabel("Name of variable 2")).toHaveValue(
      "teammate"
    );
    await name.fill("Next edit");
    await page.getByLabel("Value of variable 1").fill("Updated product");
    await page.getByRole("button", { name: "Flush", exact: true }).click();
    await browserExpect(page.getByTestId("status")).toHaveText(
      /^(idle|saved)$/
    );
    expect(
      JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}")
    ).toMatchObject({
      name: "Next edit",
      description: "Teammate description",
      variables: { product_name: "Updated product", teammate: "Preserve me" },
    });
  }
);

test("dirty form snapshots survive refresh and save through the conflict path", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Local description");
  await page.getByLabel("Value of variable 1").fill("Local product");
  await page.getByRole("button", { name: "Teammate refresh" }).click();
  await browserExpect(page.getByTestId("fetching")).toHaveText("0");
  await browserExpect(
    page.getByRole("textbox", { name: "Description", exact: true })
  ).toHaveValue("Local description");
  await browserExpect(page.getByLabel("Value of variable 1")).toHaveValue(
    "Local product"
  );
  expect(await page.getByLabel("Name of variable 2").count()).toBe(0);
  await page.getByRole("button", { name: "Flush", exact: true }).click();
  await browserExpect(page.getByTestId("status")).toHaveText("error");
  expect(
    JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}")
      .description
  ).toBe("Teammate description");
});

test("invalid local edits keep their original revision before a queue exists", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("");
  await page.getByLabel("Name of variable 1").fill("invalid key");
  await page.getByRole("button", { name: "Teammate refresh" }).click();
  await browserExpect(page.getByTestId("fetching")).toHaveText("0");
  await browserExpect(name).toHaveValue("");
  await browserExpect(page.getByLabel("Name of variable 1")).toHaveValue(
    "invalid key"
  );
  await name.fill("Corrected local edit");
  await page.getByLabel("Name of variable 1").fill("product_name");
  await page.getByRole("button", { name: "Flush", exact: true }).click();
  await browserExpect(page.getByTestId("status")).toHaveText("error");
  expect(
    JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}")
      .description
  ).toBe("Teammate description");
});

test.each(["read", "files"])(
  "failed background %s reads pause forms while navigation and retry stay usable",
  async (kind) => {
    const page = await browser.newPage();
    await page.goto(baseUrl);
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    await browserExpect(name).toHaveValue("site-a");
    const owner = await page.getByTestId("owner").textContent();
    await page
      .getByRole("button", { name: `Fail ${kind}`, exact: true })
      .click();
    await browserExpect(page.getByRole("alert")).toContainText(
      "Couldn't load your site design"
    );
    await browserExpect(page.locator("[inert]")).toHaveCount(2);
    for (const label of ["Settings", "Choose branch", "Design"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await browserExpect(page.getByTestId("navigation")).toHaveText(label);
    }
    await page.getByRole("button", { name: "Attempt edits" }).click();
    await browserExpect(name).toHaveValue("site-a");
    await browserExpect(page.getByLabel("Value of variable 1")).toHaveValue(
      "site-a"
    );
    await page.getByRole("button", { name: "Allow reads" }).click();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await browserExpect(page.getByRole("alert")).toHaveCount(0);
    await browserExpect(page.locator("[inert]")).toHaveCount(0);
    expect(await page.getByTestId("owner").textContent()).toBe(owner);
    await name.fill("After retry");
    await browserExpect(page.getByTestId("persisted")).toContainText(
      "After retry"
    );
  }
);

test.each([true, false])(
  "draft conflict recovery keeps or discards local edits (keep: %s)",
  async (keep) => {
    const page = await browser.newPage();
    await page.goto(baseUrl);
    const description = page.getByRole("textbox", {
      name: "Description",
      exact: true,
    });
    await description.fill("Local description");
    await page.getByLabel("Value of variable 1").fill("Local product");
    await page.getByRole("button", { name: "Teammate refresh" }).click();
    await browserExpect(page.getByTestId("fetching")).toHaveText("0");
    await page.getByRole("button", { name: "Flush", exact: true }).click();
    await browserExpect(page.getByTestId("status")).toHaveText("error");
    await browserExpect(page.getByRole("alert")).toContainText(
      "This site changed while you were editing"
    );
    await page.getByRole("button", { name: "Navigate away" }).click();
    await browserExpect(page.getByTestId("navigation")).toHaveText("blocked");
    await browserExpect(description).toHaveValue("Local description");
    // The resolution must use a fresh revision even if another save follows the conflict.
    await page.getByRole("button", { name: "Teammate refresh" }).click();
    if (!keep) {
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("");
      await page.getByLabel("Name of variable 1").fill("invalid key");
      await browserExpect(
        page.getByRole("button", { name: "Keep my changes" })
      ).toBeDisabled();
    }
    await page
      .getByRole("button", {
        name: keep ? "Keep my changes" : "Discard my changes",
        exact: true,
      })
      .click();
    await browserExpect(page.getByTestId("status")).toHaveText(
      /^(idle|saved)$/
    );
    await browserExpect(page.getByRole("alert")).toHaveCount(0);
    await browserExpect(page.locator("[inert]")).toHaveCount(0);
    await browserExpect(description).toHaveValue(
      keep ? "Local description" : "Teammate description"
    );
    await browserExpect(page.getByLabel("Value of variable 1")).toHaveValue(
      keep ? "Local product" : "site-a"
    );
    expect(await page.getByLabel("Name of variable 2").count()).toBe(
      keep ? 0 : 1
    );
    expect(
      JSON.parse((await page.getByTestId("persisted").textContent()) ?? "{}")
        .description
    ).toBe(keep ? "Local description" : "Teammate description");
    await page.getByRole("button", { name: "Navigate away" }).click();
    await browserExpect(page.getByTestId("navigation")).toHaveText("left");
    await description.fill("Next edit");
    await browserExpect(page.getByTestId("persisted")).toContainText(
      "Next edit"
    );
    await browserExpect(page.getByTestId("status")).toHaveText(
      /^(idle|saved)$/
    );
  }
);

test("a failed conflict recovery retains the buffer and navigation blocker", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Keep this buffer");
  await page.getByRole("button", { name: "Teammate refresh" }).click();
  await page.getByRole("button", { name: "Flush", exact: true }).click();
  await browserExpect(page.getByTestId("status")).toHaveText("error");
  await page
    .getByRole("button", { name: "Fail next read", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard my changes", exact: true })
    .click();
  await browserExpect(
    page.getByRole("button", { name: "Try again", exact: true })
  ).toBeEnabled();
  await browserExpect(name).toHaveValue("Keep this buffer");
  await page.getByRole("button", { name: "Navigate away" }).click();
  await browserExpect(page.getByTestId("navigation")).toHaveText("blocked");
  await page.getByRole("button", { name: "Allow reads" }).click();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await browserExpect(page.locator("[inert]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Discard my changes", exact: true })
    .click();
  await browserExpect(name).toHaveValue("site-a");
  await browserExpect(page.getByTestId("status")).toHaveText("idle");
  await page.getByRole("button", { name: "Navigate away" }).click();
  await browserExpect(page.getByTestId("navigation")).toHaveText("left");
});
