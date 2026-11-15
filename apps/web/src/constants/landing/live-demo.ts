import { DEMO_URL } from "@/utils/urls";

export const LIVE_DEMO_URL = `${DEMO_URL}/api/demo/enter`;

export const LIVE_DEMO_PREVIEW_SRC = "/landing/demo-preview.webp";

export const LIVE_DEMO_PREVIEW_DARK_SRC = "/landing/demo-preview-dark.webp";

export const LIVE_DEMO_PREVIEW_THEME_SCRIPT = `(() => {
  const picture = document.currentScript.previousElementSibling;
  const source = picture.querySelector("source");
  const image = picture.querySelector("img");
  const media = document.documentElement.classList.contains("dark") ? "all" : "not all";
  if (source.media !== media) source.media = media;
  if (image.loading !== "eager") image.loading = "eager";
})();`;

export const LIVE_DEMO_PREVIEW_ALT =
  "Notra GEO overview with visibility by engine and what changed";

export const LIVE_DEMO_OPEN_LABEL = "Explore the demo";
