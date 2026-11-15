import { afterEach, expect, test } from "bun:test";

import { assertAllowedSocialMediaUrls, isOwnSocialVideo } from "./media-urls";

const R2_HOST = "https://cdn.example.com";
const APP_HOST = "https://app.example.com";

afterEach(() => {
  delete process.env.CLOUDFLARE_PUBLIC_URL;
});

test("rejects relative media paths (PostForMe cannot fetch them)", () => {
  expect(() =>
    assertAllowedSocialMediaUrls(["/api/uploads/content-images/org_1/a.mp4"])
  ).toThrow("Media URL must be an absolute URL");
});

test("rejects another organization's objects on the shared host", () => {
  process.env.CLOUDFLARE_PUBLIC_URL = R2_HOST;
  expect(() =>
    assertAllowedSocialMediaUrls(
      [`${R2_HOST}/organization/org_2/clip.mp4`],
      "org_1"
    )
  ).toThrow("Media URL belongs to another organization");
  expect(() =>
    assertAllowedSocialMediaUrls(
      [`${R2_HOST}/organization/org_1/content/clip.mp4`],
      "org_1"
    )
  ).not.toThrow();
  expect(() =>
    assertAllowedSocialMediaUrls([`${R2_HOST}/organization/org_2/clip.mp4`])
  ).not.toThrow();
});

test("allows the configured R2 host, rejects app and other hosts", () => {
  process.env.CLOUDFLARE_PUBLIC_URL = R2_HOST;
  expect(() =>
    assertAllowedSocialMediaUrls([`${R2_HOST}/organization/org_1/a.mp4`])
  ).not.toThrow();
  expect(() =>
    assertAllowedSocialMediaUrls([
      `${APP_HOST}/api/uploads/content-images/a.mp4`,
    ])
  ).toThrow("Media URL host is not allowed");
  expect(() =>
    assertAllowedSocialMediaUrls(["https://evil.example.com/a.mp4"])
  ).toThrow("Media URL host is not allowed");
  for (const url of [
    "ftp://cdn.example.com/organization/org_1/a.mp4",
    "https://cdn.example.com:8443/organization/org_1/a.mp4",
  ]) {
    expect(() => assertAllowedSocialMediaUrls([url])).toThrow(
      "Media URL host is not allowed"
    );
  }
  expect(() =>
    assertAllowedSocialMediaUrls(["//evil.example.com/a.mp4"])
  ).toThrow("Media URL must be an absolute URL");
  expect(() => assertAllowedSocialMediaUrls(["not a url"])).toThrow(
    "Media URL must be an absolute URL"
  );
  expect(() =>
    assertAllowedSocialMediaUrls(["https://exa mple.com/a.mp4"])
  ).toThrow("Invalid media URL");
});

test("accepts uploaded video URLs under the configured public base path", () => {
  const key = "organization/org_1/content/clip.mp4";
  for (const base of [`${R2_HOST}/media`, `${R2_HOST}/media/`]) {
    process.env.CLOUDFLARE_PUBLIC_URL = base;
    const url = `${R2_HOST}/media/${key}`;
    expect(() => assertAllowedSocialMediaUrls([url], "org_1")).not.toThrow();
    expect(
      isOwnSocialVideo({ key, url, mimeType: "video/mp4", size: 16 }, "org_1")
    ).toBe(true);
    for (const forbidden of [
      `${R2_HOST}/media/organization/org_2/content/clip.mp4`,
      `${R2_HOST}/${key}`,
      `${R2_HOST}/media-other/${key}`,
      `${R2_HOST}/media/organization/org_1/../org_2/content/clip.mp4`,
      `${R2_HOST}/media/organization/org_1/%2e%2e/org_2/content/clip.mp4`,
    ]) {
      expect(() => assertAllowedSocialMediaUrls([forbidden], "org_1")).toThrow(
        "Media URL belongs to another organization"
      );
    }
  }
});
