import { demoSandboxRoute, rebuildDemoSandboxResponse } from "@/lib/demo/route";

export const POST = demoSandboxRoute((sandbox) =>
  rebuildDemoSandboxResponse(sandbox)
);
