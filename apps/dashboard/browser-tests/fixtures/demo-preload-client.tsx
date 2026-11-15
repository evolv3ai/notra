import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import { DemoPreloadApp } from "./demo-preload-app";

performance.mark("hydration-start");
const root = document.getElementById("root");
if (!root) {
  throw new Error("Demo preload fixture root missing");
}
hydrateRoot(
  root,
  <StrictMode>
    <DemoPreloadApp />
  </StrictMode>
);
