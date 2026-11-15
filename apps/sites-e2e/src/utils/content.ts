import assert from "node:assert/strict";

import type { Page } from "playwright";

import { cspAllowsOrigin } from "./csp";

// Content checks select by role, accessible name, fixture text and the public
// styling contract (stable IDs, data attributes), never by theme classes or
// layout, so visual changes to the theme do not break them.
export async function assertContentFeatures(
  page: Page,
  origin: string,
  waitForResources: () => Promise<void>
) {
  const checks: string[] = [];
  const components = await page.goto(`${origin}/blog/components`, {
    waitUntil: "domcontentloaded",
  });
  await waitForResources();
  assert.equal(components?.status(), 200);

  for (const [title, body] of [
    ["Info callout", "Info body text."],
    ["Warning callout", "Warning body text."],
    ["Check callout", "Check body text."],
    ["Danger callout", "Danger body text."],
    ["Generic callout", "Callout body text."],
  ]) {
    const callout = page.getByRole("complementary", { name: title });
    assert.equal(await callout.count(), 1, title);
    assert.match(
      await callout.innerText(),
      new RegExp(body.replace(".", "\\."))
    );
  }
  for (const text of ["Left column card", "Right column card"]) {
    assert.equal(await page.getByText(text, { exact: true }).isVisible(), true);
  }
  checks.push("callouts (5 variants), columns with cards");

  const firstAnswer = page.getByText("First answer text.");
  assert.equal(await firstAnswer.isVisible(), false);
  await page.getByText("First question", { exact: true }).click();
  assert.equal(await firstAnswer.isVisible(), true);
  checks.push("accordion group expands on click");

  const secondTab = page.getByRole("tab", { name: "Second tab" });
  assert.equal(await page.getByText("Second tab body.").isVisible(), false);
  await secondTab.click();
  assert.equal(await secondTab.getAttribute("aria-selected"), "true");
  assert.equal(await page.getByText("Second tab body.").isVisible(), true);
  assert.equal(await page.getByText("First tab body.").isVisible(), false);
  checks.push("tabs switch panels with aria-selected");

  const steps = page.getByRole("listitem").filter({
    hasText: /Install the CLI|Publish the site/,
  });
  assert.deepEqual(
    (await steps.allInnerTexts()).map((text) => text.split("\n")[0]?.trim()),
    ["Install the CLI", "Publish the site"]
  );
  const body = await page.locator("body").innerText();
  for (const code of ["npm install acme-cloud", "bun add acme-cloud"]) {
    assert.ok(body.includes(code), code);
  }
  checks.push("ordered steps, code group blocks");

  const video = page.locator('video[title="Acme demo video"]');
  assert.match((await video.getAttribute("src")) ?? "", /\/images\/demo\.mp4$/);
  const youtube = page.locator('iframe[title="Acme on YouTube"]');
  assert.equal(
    await youtube.getAttribute("src"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  );
  const policy = components?.headers()["content-security-policy"];
  assert.ok(
    !policy ||
      cspAllowsOrigin(
        policy,
        "frame-src",
        "https://www.youtube-nocookie.com"
      ) ||
      !/(?:^|;)\s*(?:frame-src|child-src|default-src)\s/.test(policy),
    `CSP must allow the YouTube embed: ${policy}`
  );
  checks.push("video element, YouTube embed allowed by CSP");

  const sections = page.getByRole("navigation", { name: "Sections" });
  const sectionLinks = await sections
    .first()
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).pathname)
    );
  assert.ok(sectionLinks.some((path) => path.startsWith("/blog")));
  assert.ok(sectionLinks.some((path) => path.startsWith("/changelog")));
  const theme = page.getByRole("radiogroup", { name: "Theme" }).first();
  await theme.getByRole("radio", { name: "Dark" }).click();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    ),
    true
  );
  await theme.getByRole("radio", { name: "Light" }).click();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    ),
    false
  );
  checks.push("site areas navigation, theme toggle");

  assert.deepEqual(
    await page.evaluate(() => ({
      style: getComputedStyle(document.documentElement)
        .getPropertyValue("--e2e-global-style")
        .trim(),
      script: document.documentElement.dataset.e2eGlobalScript,
    })),
    { style: "loaded", script: "ran" }
  );
  checks.push("global style.css and script.js apply under the CSP");

  const badge = page.getByRole("link", { name: "Powered by Notra" });
  assert.equal(await badge.count(), 1);
  assert.equal(await badge.isVisible(), true);
  const badgeBox = await badge.boundingBox();
  assert.ok(
    badgeBox && badgeBox.width > 0 && badgeBox.height > 0,
    "the Notra badge keeps its size under site CSS"
  );
  checks.push("Powered by Notra badge stays visible under site CSS hiding it");

  await page.goto(`${origin}/blog/hello-world`, {
    waitUntil: "domcontentloaded",
  });
  await waitForResources();
  const post = await page.locator("body").innerText();
  for (const text of [
    "Built with Acme Cloud",
    "Start free trial",
    "Jan Burzinski",
  ]) {
    assert.ok(post.includes(text), text);
  }
  // The slot interpolates the post title; quotes may be typographic.
  assert.match(post, /Enjoyed .Hello world.\?/);
  assert.equal(
    (await page.locator('a[href="mailto:help@acme.example.com"]').count()) > 0,
    true
  );
  checks.push("header/footer/after-post slot, content variables, author");

  for (const [path, text] of [
    ["/blog/tags/components", "Every built-in component"],
    ["/changelog/tags/feature", "Component updates"],
  ]) {
    const response = await page.goto(`${origin}${path}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForResources();
    assert.equal(response?.status(), 200, path);
    assert.ok((await page.locator("body").innerText()).includes(text), path);
  }
  await page.goto(`${origin}/changelog`, { waitUntil: "domcontentloaded" });
  await waitForResources();
  const update = page.locator("#october-2026");
  assert.ok(
    (await update.innerText()).includes("The update body for October.")
  );
  checks.push("tag pages for blog and changelog, changelog Update entry");

  await page.goto(`${origin}/blog/2026/launch`, {
    waitUntil: "domcontentloaded",
  });
  await waitForResources();
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  assert.ok(
    ogImage && ogImage.startsWith(origin),
    `OG image on the site: ${ogImage}`
  );
  const image = await page.goto(ogImage);
  await waitForResources();
  assert.equal(image?.status(), 200);
  assert.match(image?.headers()["content-type"] ?? "", /^image\//);
  checks.push("generated OG image is served");
  return checks;
}
