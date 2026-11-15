import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { consentManifest } from "c15t/tanstack-start/build";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

import { SERVER_ONLY_PACKAGES } from "./src/constants/framework.ts";
import { dashboardWorkflow } from "./src/utils/framework-workflow-plugin.ts";

export default defineConfig(({ mode }) => {
  const publicEnvironment = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  const define = Object.fromEntries(
    Object.entries({ ...publicEnvironment, ...process.env })
      .filter(
        ([key, value]) => key.startsWith("NEXT_PUBLIC_") && value !== undefined
      )
      .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
  );

  return {
    build: {
      reportCompressedSize: false,
      rolldownOptions: { checks: { moduleLevelDirective: false } },
    },
    define,
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              // Every page loads the entry's static module graph anyway; as
              // ~170 tiny shared chunks it cost one request each. Grouping it
              // needs strict execution order, or modules in the merged chunks
              // initialize before their dependencies.
              strictExecutionOrder: true,
              codeSplitting: {
                groups: [
                  { name: "initial", tags: ["$initial"], maxSize: 400_000 },
                ],
              },
            },
            treeshake: {
              manualPureFunctions: [
                "console.log",
                "console.info",
                "console.debug",
                "console.trace",
              ],
            },
          },
        },
      },
    },
    optimizeDeps: {
      exclude: SERVER_ONLY_PACKAGES,
    },
    server: { host: "127.0.0.1", port: 3000, strictPort: true },
    resolve: {
      alias: [
        {
          find: /^@\/components\/ui\//,
          replacement: fileURLToPath(
            new URL("../../packages/ui/src/components/ui/", import.meta.url)
          ),
        },
        {
          find: "@",
          replacement: fileURLToPath(new URL("src", import.meta.url)),
        },
        {
          find: /^shiki\/wasm$/,
          replacement: fileURLToPath(import.meta.resolve("shiki/wasm")),
        },
      ],
    },
    plugins: [
      dashboardWorkflow(),
      tailwindcss(),
      consentManifest({
        backendURL: "https://notra-prod-notra.inth.app",
      }),
      tanstackStart(),
      react({ compiler: true }),
      nitro({ traceDeps: ["harfbuzzjs*", "satori"] }),
    ],
    ssr: {
      // React is external too (as in apps/web), so the bundle and external
      // packages share one React instance.
      external: [
        "autumn-js",
        "react",
        "react-dom",
        "@resvg/resvg-js",
        "@cursor/sdk",
        "@ai-sdk/code-mode",
        "run",
        "satori",
        "sharp",
        "wawoff2",
      ],
    },
  };
});
