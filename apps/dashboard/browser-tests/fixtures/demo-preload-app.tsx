import { StrictMode, useState } from "react";

import { DemoHumanCheck } from "../../src/components/demo/demo-human-check";

export function DemoPreloadApp() {
  const [token, setToken] = useState("");
  return (
    <StrictMode>
      <DemoHumanCheck
        siteKey="synthetic-site-key"
        failureMessage="Synthetic verification failed"
        onToken={setToken}
      />
      <output>{token}</output>
    </StrictMode>
  );
}
