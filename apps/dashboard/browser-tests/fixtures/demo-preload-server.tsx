import { renderToString } from "react-dom/server";

import { DemoPreloadApp } from "./demo-preload-app";

export function render(configured = true) {
  return `<!doctype html><html lang="en"><head><title>Demo preload regression</title></head><body><main id="root">${renderToString(configured ? <DemoPreloadApp /> : null)}</main><script type="module" src="/fixture.js"></script></body></html>`;
}
