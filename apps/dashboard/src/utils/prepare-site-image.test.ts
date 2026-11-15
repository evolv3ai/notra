import { beforeAll, expect, test } from "bun:test";

import sharp from "sharp";

let prepareSiteImage: typeof import("./prepare-site-image").prepareSiteImage;
let SiteImageInputError: typeof import("./prepare-site-image").SiteImageInputError;

beforeAll(async () => {
  ({ prepareSiteImage, SiteImageInputError } =
    await import("./prepare-site-image"));
});

function gradient(width: number, height: number, alpha = false) {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let index = 0; index < width * height; index++) {
    const x = index % width;
    raw[index * channels] = (x * 255) / width;
    raw[index * channels + 1] = 180;
    raw[index * channels + 2] = 240;
    if (alpha) {
      raw[index * channels + 3] = x < width / 2 ? 0 : 255;
    }
  }
  return sharp(raw, { raw: { width, height, channels } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

test("backgrounds become WebP no wider than 2560px", async () => {
  const input = await gradient(3200, 1800);
  const output = await prepareSiteImage(input, "background");
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.width).toBe(2560);
  expect(output.byteLength).toBeLessThan(input.byteLength / 10);
});

test("logos stay PNG with their transparency, scaled to 512px", async () => {
  const output = await prepareSiteImage(
    await gradient(1024, 1024, true),
    "logo"
  );
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe("png");
  expect(metadata.hasAlpha).toBe(true);
  expect(metadata.width).toBe(512);
});

test("small, already compact images and non-raster files are kept", async () => {
  const tiny = await sharp(await gradient(64, 64))
    .webp({ quality: 50 })
    .toBuffer();
  expect(await prepareSiteImage(tiny, "background")).toBe(tiny);
  const icon = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]);
  expect(await prepareSiteImage(icon, "favicon")).toBe(icon);
});

test("small WebP logos still become PNG for share images", async () => {
  const logo = await sharp(await gradient(256, 256, true))
    .webp({ quality: 60 })
    .toBuffer();
  const metadata = await sharp(await prepareSiteImage(logo, "logo")).metadata();
  expect(metadata.format).toBe("png");
});

test("GIF and animated logos and share images become stills; ICO logos are rejected", async () => {
  // 1×1 GIF with a black and a white frame.
  const animated = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAAAICTAEAOw==",
    "base64"
  );
  expect((await sharp(animated).metadata()).pages).toBe(2);
  const metadata = await sharp(
    await prepareSiteImage(animated, "logo")
  ).metadata();
  expect(metadata.format).toBe("png");
  expect(metadata.pages ?? 1).toBe(1);
  expect(metadata.height).toBe(1);
  const share = await sharp(
    await prepareSiteImage(animated, "share")
  ).metadata();
  expect(["png", "jpeg"]).toContain(share.format);
  expect(share.pages ?? 1).toBe(1);
  expect(await prepareSiteImage(animated, "background")).toBe(animated);
  const icon = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]);
  expect(prepareSiteImage(icon, "logo")).rejects.toBeInstanceOf(
    SiteImageInputError
  );
});

test("APNG backgrounds and favicons keep their frames; logos and share images become stills", async () => {
  const animated = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAABAAAAAQAAAAAAAAAAAAEACgAAWn8w0AAAAA1JREFUeJxj+M/A8B8ABQAB/4mZPR0AAAAaZmNUTAAAAAEAAAABAAAAAQAAAAAAAAAAAAEACgAAwQzaBAAAABFmZEFUAAAAAnicY/jPwPAfAAUAAf+alZNkAAAAAElFTkSuQmCC",
    "base64"
  );
  expect(await prepareSiteImage(animated, "background")).toBe(animated);
  expect(await prepareSiteImage(animated, "favicon")).toBe(animated);
  const logo = await prepareSiteImage(animated, "logo");
  expect((await sharp(logo).metadata()).format).toBe("png");
  expect(Buffer.from(logo).includes(Buffer.from("acTL"))).toBe(false);
  const share = await prepareSiteImage(animated, "share");
  expect(Buffer.from(share).includes(Buffer.from("acTL"))).toBe(false);
});

test("metadata such as GPS never survives, even when nothing shrinks", async () => {
  const photo = await sharp(await gradient(256, 256))
    .jpeg({ quality: 40 })
    .withExif({ IFD0: { Copyright: "Synthetic" } })
    .toBuffer();
  expect((await sharp(photo).metadata()).exif).toBeDefined();
  const output = await prepareSiteImage(photo, "logo");
  expect((await sharp(output).metadata()).exif).toBeUndefined();
});

test("images over 40 megapixels are rejected with a readable error", async () => {
  const huge = await sharp({
    create: { width: 8000, height: 5100, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  await expect(prepareSiteImage(huge, "background")).rejects.toBeInstanceOf(
    SiteImageInputError
  );
});

test("share images become JPEG or PNG at 1200px; SVG and ICO are rejected", async () => {
  const photo = await sharp(await gradient(2400, 1260))
    .webp({ quality: 90 })
    .toBuffer();
  const output = await sharp(await prepareSiteImage(photo, "share")).metadata();
  expect(output.format).toBe("jpeg");
  expect(output.width).toBe(1200);
  const png = await prepareSiteImage(await gradient(2400, 1260), "share");
  expect((await sharp(png).metadata()).format).toBe("png");
  const transparent = await sharp(await gradient(800, 420, true))
    .webp({ quality: 90 })
    .toBuffer();
  const kept = await sharp(
    await prepareSiteImage(transparent, "share")
  ).metadata();
  expect(kept.format).toBe("png");
  expect(kept.hasAlpha).toBe(true);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const icon = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]);
  for (const input of [svg, icon]) {
    await expect(prepareSiteImage(input, "share")).rejects.toBeInstanceOf(
      SiteImageInputError
    );
  }
});
