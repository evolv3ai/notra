import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import { DemoStartApp } from "./demo-start-app";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Demo start fixture root missing");
}

hydrateRoot(
  root,
  <StrictMode>
    <DemoStartApp
      returnTo="/finished"
      turnstileSiteKey={
        location.search.includes("unconfigured") ? null : "synthetic-site-key"
      }
    />
  </StrictMode>
);
