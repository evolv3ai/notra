import { defineAgent } from "eve";

import { createAssistantModel } from "./lib/utils/model";

export default defineAgent({
  build: {
    externalDependencies: [
      "@ai-sdk/devtools",
      "@ai-sdk/gateway",
      "@aws-sdk/client-s3",
      "@vercel/oidc",
      "@linear/sdk",
      "@octokit/core",
      "@resvg/resvg-js",
      "@upstash/box",
      "@upstash/redis",
      // Share libraries across tool bundles; keep sanitize-html bundled for CJS/ESM compatibility.
      "ai",
      "autumn-js",
      "ws",
      "evlog",
      "undici",
      "drizzle-orm",
      "echarts",
      "effect",
      "marked",
      "pg",
      "satori",
      "satori-html",
      "zod",
    ],
  },
  model: createAssistantModel(),
});
